"use client";

import Lottie from "lottie-react";
import Link from "next/link";
import { type FC } from "react";
import loadingJson from "~/../public/animations/loading.json";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

interface UsersFeedProps {
  initialUsers: RouterOutputs["users"]["getAll"];
}

const UsersFeed: FC<UsersFeedProps> = ({ initialUsers }) => {
  const { data: users, isLoading } = api.users.getAll.useQuery(undefined, {
    initialData: initialUsers,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="grid grid-cols-5 gap-2">
      {!isLoading ? (
        users.map((user) => (
          <Link
            href={`/usuarios/permisos/${user.id}`}
            key={user.id}
            className="flex flex-col items-center justify-center space-y-1 rounded-xl border border-muted p-4 transition-all hover:scale-105"
          >
            <h1 className="text-lg font-semibold">{user.name}</h1>
            <p>{user.email}</p>
            <p className="text-muted-foreground">
              {
                // @ts-ignore
                user.permissions.length
              }{" "}
              {
                // @ts-ignore
                user.permissions.length > 1 ? "Permisos" : "Permiso"
              }
            </p>
          </Link>
        ))
      ) : (
        <Lottie animationData={loadingJson} className="h-24" loop={true} />
      )}
    </div>
  );
};

export default UsersFeed;
