import Link from "next/link";
import { type FC } from "react";
import { cn } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/shared";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";

interface UserCardProps {
  user: RouterOutputs["users"]["getAll"][number];
}

const UserCard: FC<UserCardProps> = ({ user }) => {
  return (
    <Card
      className={cn(
        user.role && user.role.color === "red"
          ? "border-red"
          : user.role && user.role.color === "amber-400"
          ? "border-amber-400"
          : user.role && user.role.color === "green"
          ? "border-green"
          : user.role && user.role.color === "primary"
          ? "border-primary"
          : user.role && user.role.color === "violet-500"
          ? "border-violet-500"
          : user.role && user.role.color === "orange"
          ? "border-orange"
          : user.role && user.role.color === "pink-500"
          ? "border-pink-500"
          : user.role && user.role.color === "blue-400"
          ? "border-blue-400"
          : "border-gray-400",
      )}
    >
      <CardHeader>
        <CardTitle>
          <Link
            href={`/usuarios/permisos/${user.id}`}
            key={user.id}
            className="flex flex-col items-center justify-center rounded-xl transition-all hover:scale-105"
          >
            {user.name}
          </Link>
        </CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
    </Card>
  );
};

export default UserCard;
