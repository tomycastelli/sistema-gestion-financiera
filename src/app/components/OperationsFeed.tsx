"use client";

import type { User } from "next-auth";
import dynamic from "next/dynamic";
import { type FC } from "react";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import Operation from "./Operation";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";
const LoadingAnimation = dynamic(
  () => import("../components/LoadingAnimation"),
);

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
          <LoadingAnimation text={"Cargando operaciones"} />
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
          <p className="my-8 text-4xl">No se encontraron operaciones</p>
        )}
      </div>
    </div>
  );
};

export default OperationsFeed;
