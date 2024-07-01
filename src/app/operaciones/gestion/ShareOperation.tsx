"use client";

import { type FC } from "react";
import { api } from "~/trpc/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/app/components/ui/dropdown-menu";
import { Button } from "~/app/components/ui/button";
import { Icons } from "~/app/components/ui/Icons";
import LoadingAnimation from "~/app/components/LoadingAnimation";
import { toast } from "sonner";

interface ShareOperationProps {
  operationId: number;
}

const ShareOperation: FC<ShareOperationProps> = ({ operationId }) => {
  const {
    data: chats,
    isLoading,
    isSuccess,
  } = api.messages.getUserChats.useQuery(undefined, {
    staleTime: 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const { mutateAsync: sendMessage } = api.messages.sendMessage.useMutation({
    onSuccess(_, variables) {
      toast.success(
        `Operación ${operationId} compartida al chat ${variables.chatId}`,
      );
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-transparent p-2">
          <Icons.shareLink className="h-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" side="top">
        <DropdownMenuLabel>Compartir con:</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {!isLoading ? (
            isSuccess &&
            chats.map((chat) => (
              <DropdownMenuItem
                className="flex flex-row justify-between"
                key={chat.id}
                onClick={() =>
                  sendMessage({
                    chatId: chat.id,
                    message: `operation:${operationId}`,
                    timestamp: Date.now(),
                  })
                }
              >
                <span>
                  {chat.name
                    ? chat.name
                    : chat.users.length < 4
                      ? chat.users.map((obj) => obj.name).join(", ")
                      : chat.id.toString()}
                </span>
                <Icons.sendArrowRight className="h-4" />
              </DropdownMenuItem>
            ))
          ) : (
            <LoadingAnimation size="sm" text="Cargando chats" />
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareOperation;
