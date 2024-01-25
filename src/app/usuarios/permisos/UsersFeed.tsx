"use client";

import Lottie from "lottie-react";
import { type FC } from "react";
import loadingJson from "~/../public/animations/loading.json";
import UserCard from "~/app/components/ui/UserCard";
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
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-5">
      {!isLoading ? (
        users.map((user) => <UserCard user={user} key={user.id} />)
      ) : (
        <Lottie animationData={loadingJson} className="h-24" loop={true} />
      )}
    </div>
  );
};

export default UsersFeed;
