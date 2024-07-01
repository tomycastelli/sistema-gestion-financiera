"use client";

import { type FC, useState } from "react";
import { api } from "~/trpc/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Button } from "../components/ui/button";
import { Icons } from "../components/ui/Icons";
import { ScrollArea } from "../components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { getInitials } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { type User } from "lucia";
import LoadingAnimation from "../components/LoadingAnimation";
import { toast } from "sonner";

interface AddChatProps {
  user: User;
}

const AddChat: FC<AddChatProps> = ({ user }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [usersToAdd, setUsersToAdd] = useState<string[]>([]);
  const [chatName, setChatName] = useState<string | undefined>(undefined);

  const {
    data: users,
    isLoading,
    isSuccess,
  } = api.users.getAll.useQuery(undefined, {
    enabled: isDropdownOpen,
    refetchOnWindowFocus: false,
  });

  const utils = api.useContext();

  const { mutateAsync } = api.messages.createChat.useMutation({
    async onMutate(newOperation) {
      // Doing the Optimistic update
      await utils.messages.getUserChats.cancel();

      const prevData = utils.messages.getUserChats.getData();

      utils.messages.getUserChats.setData(undefined, (old) => {
        if (old && old.length > 0) {
          return [
            ...old,
            {
              id: 0,
              name: newOperation.name ?? null,
              unseenMessages: 0,
              users: Array.from(newOperation.usersIds).map((obj) => ({
                id: obj,
                name: users?.find((item) => item.id === obj)?.name ?? "",
              })),
            },
          ];
        } else {
          return [
            {
              id: 0,
              name: newOperation.name ?? null,
              unseenMessages: 0,
              users: Array.from(newOperation.usersIds).map((obj) => ({
                id: obj,
                name: users?.find((item) => item.id === obj)?.name ?? "",
              })),
            },
          ];
        }
      });

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.messages.getUserChats.setData(undefined, ctx?.prevData);
      setUsersToAdd([]);

      toast.error("No se pudo crear el chat", {
        description: err.message,
      });
    },
    onSettled() {
      void utils.messages.getUserChats.invalidate();
    },
    onSuccess() {
      toast.success("Chat creado");
    },
  });

  return (
    <DropdownMenu onOpenChange={setIsDropdownOpen} open={isDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="mx-auto flex justify-center">
          <Icons.plus className="mr-2 h-4 w-4 text-green" />
          Nuevo chat
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            type="text"
            value={chatName}
            onChange={(e) => setChatName(e.target.value)}
            disabled={usersToAdd.length < 2}
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {!isLoading ? (
            <ScrollArea className="h-32 w-full">
              {isSuccess &&
                users
                  .filter((obj) => obj.id !== user.id)
                  .map((userObj) => (
                    <DropdownMenuItem
                      key={userObj.id}
                      onSelect={(e) => e.preventDefault()}
                      onClick={() => {
                        if (usersToAdd.includes(userObj.id)) {
                          setUsersToAdd(
                            usersToAdd.filter((obj) => obj !== userObj.id),
                          );
                        } else {
                          setUsersToAdd([...usersToAdd, userObj.id]);
                        }
                      }}
                    >
                      <Avatar className="mr-2 h-5 w-5">
                        <AvatarImage
                          src={userObj.photoUrl ? userObj.photoUrl : undefined}
                        />
                        <AvatarFallback
                          className={cn(
                            usersToAdd.includes(userObj.id) && "bg-primary",
                          )}
                        >
                          {userObj.name && getInitials(userObj.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          usersToAdd.includes(userObj.id) && "font-semibold",
                        )}
                      >
                        {userObj.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
            </ScrollArea>
          ) : (
            <LoadingAnimation text="Cargando usuarios" />
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            mutateAsync({ usersIds: new Set(usersToAdd), name: chatName })
          }
          disabled={usersToAdd.length < 1}
        >
          <Icons.circlePlus className="mr-4 h-5 w-5" />
          <span>{`Crear chat (${usersToAdd.length})`}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AddChat;
