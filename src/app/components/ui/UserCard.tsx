import Link from "next/link";
import { type FC } from "react";
import { type RouterOutputs } from "~/trpc/shared";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";

interface UserCardProps {
  user: RouterOutputs["users"]["getAll"][number];
}

const UserCard: FC<UserCardProps> = ({ user }) => {
  return (
    <Card>
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
