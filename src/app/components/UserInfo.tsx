import { type User } from "lucia";
import { type FC } from "react";
import { getInitials } from "~/lib/functions";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { logOut } from "~/server/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Icons } from "./ui/Icons";

interface UserInfoProps {
  user: User;
}

const UserInfo: FC<UserInfoProps> = ({ user }) => {
  const logOutAction = async () => {
    "use server";
    await logOut();
  };
  const userData = [
    {
      name: "Nombre",
      value: user.name,
    },
    {
      name: "Id",
      value: user.id,
    },
    {
      name: "Email",
      value: user.email,
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="cursor-default">
        <Button
          variant="outline"
          className="rounded-full p-4 hover:bg-primary hover:text-white"
        >
          <Icons.person className="h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="flex w-min flex-col justify-start gap-2 p-4">
        {userData.map((obj) => (
          <div key={obj.name} className="flex flex-col justify-start text-sm">
            <h1 className="font-semibold">{obj.name}</h1>
            <p>{obj.value}</p>
          </div>
        ))}
        <form action={logOutAction} method="POST">
          <Button variant="outline" size="sm" type="submit">
            Logout
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserInfo;
