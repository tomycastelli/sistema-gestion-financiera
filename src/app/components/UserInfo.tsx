import { type User } from "lucia";
import { type FC } from "react";
import { getInitials } from "~/lib/functions";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { logOut } from "~/server/auth";

interface UserInfoProps {
  user: User;
}

const UserInfo: FC<UserInfoProps> = ({ user }) => {
  const logOutAction = async () => {
    "use server"
    await logOut()
  }
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
    <HoverCard>
      <HoverCardTrigger asChild className="cursor-default">
        <Avatar>
          <AvatarImage src={user.photoUrl ? user.photoUrl : undefined} />
          <AvatarFallback>{user.name && getInitials(user.name)}</AvatarFallback>
        </Avatar>
      </HoverCardTrigger>
      <HoverCardContent className="flex w-min flex-col justify-start gap-1 px-4">
        {userData.map((obj) => (
          <div key={obj.name} className="flex flex-col justify-start text-sm">
            <h1 className="font-semibold">{obj.name}</h1>
            <p>{obj.value}</p>
          </div>
        ))}
        <form action={logOutAction} method="POST">
          <Button variant="outline" size="sm" type="submit">Logout</Button>
        </form>
      </HoverCardContent>
    </HoverCard>
  );
};

export default UserInfo;
