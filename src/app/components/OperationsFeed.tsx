"use client";

import Lottie from "lottie-react";
import type { User } from "next-auth";
import { Suspense, type FC } from "react";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import LoadingAnimation from "./LoadingAnimation";
import Operation from "./Operation";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";

interface OperationsFeedProps {
  initialOperations: RouterOutputs["operations"]["getOperations"];
  users: RouterOutputs["users"]["getAll"];
  initialEntities: RouterOutputs["entities"]["getAll"];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  user: User;
}

const OperationsFeed: FC<OperationsFeedProps> = ({
  initialOperations,
  users,
  user,
  initialEntities,
  operationsQueryInput,
}) => {
  const { data, isRefetching, refetch } = api.operations.getOperations.useQuery(
    operationsQueryInput,
    {
      initialData: initialOperations,
      refetchOnWindowFocus: false,
    },
  );

  const { data: entities } = api.entities.getAll.useQuery(undefined, {
    initialData: initialEntities,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return (
    <div className="flex flex-col">
      <Button
        className="flex w-min"
        variant="outline"
        onClick={() => refetch()}
      >
        Recargar operaciones <Icons.reload className="ml-2 h-5" />
      </Button>
      <div className="grid grid-cols-1">
        {isRefetching ? (
          <Lottie
            animationData={loadingJson}
            className="absolute z-10 ml-auto flex h-36 w-full"
            loop={true}
          />
        ) : data.operations.length > 0 ? (
          data.operations
            .filter((op) => op.isVisualizeAllowed)
            .map((op) => {
              return (
                <div key={op.id} className="flex flex-col">
                  <Operation
                    users={users}
                    entities={entities}
                    operation={op}
                    operationsQueryInput={operationsQueryInput}
                    user={user}
                    isInFeed={true}
                  />
                </div>
              );
            })
        ) : (
          <p className="text-2xl">No se encontraron operaciones</p>
        )}
      </div>
    </div>
  );
};

export default OperationsFeed;
