"use client";

import { type User } from "lucia";
import React, { useRef, type FC, useEffect } from "react";
import { type RouterOutputs } from "~/trpc/shared";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "~/app/components/ui/avatar";
import { useState } from "react";
import dynamic from "next/dynamic";
import moment from "moment";
import { Input } from "~/app/components/ui/input";
import { getInitials, timeout } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { Button } from "~/app/components/ui/button";
import { Icons } from "~/app/components/ui/Icons";
import { api } from "~/trpc/react";
import { z } from "zod";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/app/components/ui/form";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { ScrollArea } from "~/app/components/ui/scroll-area";
import { toast } from "sonner";
import {
  HoverCardTrigger,
  HoverCard,
  HoverCardContent,
} from "~/app/components/ui/hover-card";
const InlineOperation = dynamic(() => import("./InlineOperation"));
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/app/components/ui/alert-dialog";

const FormSchema = z.object({
  messageText: z.string().min(1, {
    message: "El mensaje no puede ser vacio",
  }),
});

interface ChatComponentProps {
  initialMessagesHistory: RouterOutputs["messages"]["getChatHistory"];
  chatId: number;
  users: RouterOutputs["users"]["getAll"];
  currentUser: User;
  chatUrl: string;
}

const Chat: FC<ChatComponentProps> = ({
  initialMessagesHistory,
  chatId,
  users,
  currentUser,
  chatUrl,
}) => {
  const [historyPage, setHistoryPage] = useState<number>(1);

  const [messages, setMessages] = useState<
    RouterOutputs["messages"]["getChatHistory"]
  >([]);

  const [canFetchMore, setCanFetchMore] = useState<boolean>(false);

  const utils = api.useContext();

  const { isRefetching, refetch } = api.messages.getChatHistory.useQuery(
    { chatId: chatId, limit: 15, page: historyPage },
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      initialData: initialMessagesHistory,
      onSuccess(data) {
        setMessages(
          [...data, ...messages].sort((a, b) => a.timestamp - b.timestamp),
        );
        utils.messages.getUserChats.setData(undefined, (old) =>
          old?.map((obj) => {
            if (obj.id === chatId) {
              return { ...obj, unseenMessages: 0 };
            } else {
              return obj;
            }
          }),
        );
        if (data.length === 15) {
          setCanFetchMore(true);
        } else {
          setCanFetchMore(false);
        }
      },
    },
  );

  const messageSchema = z.object({
    userid: z.string(),
    timestamp: z.number(),
    message: z.string(),
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      messageText: "",
    },
  });

  const { mutateAsync } = api.messages.sendMessage.useMutation();
  const { mutateAsync: deleteMessage } = api.messages.deleteMessage.useMutation(
    {
      onSuccess() {
        scrollToBottom("instant");
        setMessages([]);
        setHistoryPage(1);
        void refetch();
        toast.success("Mensaje eliminado");
      },
    },
  );

  const { mutateAsync: updateLastConnection } =
    api.messages.updateChatLastConnection.useMutation();

  const { handleSubmit, control, reset } = form;

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    await mutateAsync({
      chatId: chatId,
      timestamp: Date.now(),
      message: data.messageText,
    });
    reset();

    await timeout(250);
    scrollToBottom("smooth");
  };

  const websocketURL = `wss://${chatUrl}/ws?chatId=${chatId}`;

  const { readyState } = useWebSocket(websocketURL, {
    onClose: () =>
      void updateLastConnection({
        chatId: chatId,
        userId: currentUser.id,
        lastConnection: Date.now(),
      }),
    onMessage: (event) => {
      const json = JSON.parse(event.data);
      const result = messageSchema.safeParse(json);
      if (!result.success) {
        toast.error("Mensaje recibido con formato incorrecto", {
          description: JSON.stringify(json),
        });
      } else {
        setMessages((prev) =>
          prev.concat({
            id: 0,
            userId: result.data.userid,
            message: result.data.message,
            timestamp: result.data.timestamp,
          }),
        );
      }
    },
  });

  const connectionStatus = {
    [ReadyState.CONNECTING]: { color: "text-yellow", text: "Conectando" },
    [ReadyState.OPEN]: { color: "text-green", text: "Conectado" },
    [ReadyState.CLOSING]: { color: "text-yellow", text: "Cerrando" },
    [ReadyState.CLOSED]: { color: "text-red", text: "Sin conexión" },
    [ReadyState.UNINSTANTIATED]: { color: "text-red", text: "Sin conexión" },
  }[readyState];

  const [parent] = useAutoAnimate();

  const bottomDivRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: "smooth" | "instant") => {
    if (bottomDivRef.current) {
      bottomDivRef.current.scrollIntoView({
        behavior: behavior,
        block: "end",
      });
    }
  };

  useEffect(() => {
    const waitForBottom = async () => {
      await timeout(200);
      scrollToBottom("instant");
    };

    void waitForBottom();
  }, []);

  function parseOperationString(
    str: string,
  ): { valid: boolean } & (
    | ({ valid: true } & { number: number })
    | { valid: false }
  ) {
    const match = str.match(/^operation:(\d+)$/);
    if (match && match[1]) {
      return { valid: true, number: parseInt(match[1], 10) };
    } else {
      return { valid: false };
    }
  }

  return (
    <div className="mx-auto flex h-full w-4/5 flex-col gap-4 rounded-xl">
      <ScrollArea className="h-[550px] rounded-xl border border-muted p-8">
        <div className="grid grid-cols-1 gap-1" ref={parent}>
          {isRefetching && (
            <h2 className="text-lg font-semibold">Cargando mensajes...</h2>
          )}
          {canFetchMore && (
            <div className="flex w-full items-center justify-center">
              <Button onClick={() => setHistoryPage(historyPage + 1)}>
                Cargar mas
              </Button>
            </div>
          )}
          {messages.map((msg, idx) => {
            const user = users.find((obj) => obj.id === msg.userId);
            const isOperationInMessage = parseOperationString(msg.message);
            return (
              <div
                key={idx}
                className={cn(
                  "flex max-w-sm flex-col gap-1 rounded-xl p-2",
                  msg.userId === currentUser.id
                    ? "items-end justify-end justify-self-end border-r-4 border-r-muted"
                    : "items-start justify-start justify-self-start border-l-4 border-l-muted",
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-1",
                    msg.userId === currentUser.id
                      ? "flex-row justify-end"
                      : "flex-row-reverse justify-start",
                  )}
                >
                  {!isOperationInMessage.valid ? (
                    <p className="text-lg">{msg.message}</p>
                  ) : (
                    <InlineOperation
                      operationId={isOperationInMessage.number}
                    />
                  )}
                  {user ? (
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user.photoUrl ? user.photoUrl : undefined}
                      />
                      <AvatarFallback>
                        {user.name && getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Avatar>
                      <AvatarFallback></AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <p className="text-md text-muted-foreground">
                  {moment(msg.timestamp).format("DD-MM-YY HH:mm")}
                </p>
                {msg.userId === currentUser.id && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-transparent p-1"
                      >
                        <Icons.cross className="h-4 text-red" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará el mensaje
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red"
                          onClick={() =>
                            deleteMessage({
                              chatId: chatId,
                              timestamp: msg.timestamp,
                              message: msg.message,
                            })
                          }
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
          <div ref={bottomDivRef} />
        </div>
      </ScrollArea>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex h-16 w-full flex-row items-center gap-2"
        >
          <FormField
            control={control}
            name="messageText"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input className="w-full" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">
            <Icons.send className="h-5 w-5" />
          </Button>
          <HoverCard>
            <HoverCardTrigger asChild>
              <button>
                <Icons.globe
                  className={cn("h-8 w-8", connectionStatus.color)}
                />
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="flex w-24 flex-wrap items-center justify-center">
              <p className={connectionStatus.color}>{connectionStatus.text}</p>
            </HoverCardContent>
          </HoverCard>
        </form>
      </Form>
    </div>
  );
};

export default Chat;
