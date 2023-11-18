"use client";

import Lottie from "lottie-react";
import type { User } from "next-auth";
import { type FC } from "react";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import Operation from "./Operation";
import FilterOperationsForm from "./forms/FilterOperationsForm";

interface OperationsFeedProps {
  initialOperations: RouterOutputs["operations"]["getOperations"];
  initialEntities: RouterOutputs["entities"]["getAll"];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  user: User;
}

const OperationsFeed: FC<OperationsFeedProps> = ({
  initialOperations,
  user,
  initialEntities,
  operationsQueryInput,
}) => {
  const { data: operations, isFetching } =
    api.operations.getOperations.useQuery(operationsQueryInput, {
      initialData: initialOperations,
      refetchOnWindowFocus: false,
    });

  const { data: entities } = api.entities.getAll.useQuery(undefined, {
    initialData: initialEntities,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return (
    <div className="flex flex-col">
      <div className="mb-4 w-full">
        <FilterOperationsForm entities={entities} />
      </div>
      <h3 className="text-xl font-bold">Página {operationsQueryInput.page}</h3>
      <div className="grid grid-cols-1">
        {isFetching && (
          <Lottie
            animationData={loadingJson}
            className="absolute z-10 ml-auto flex h-36 w-full"
            loop={true}
          />
        )}
        {operations.map((op) => {
          return (
            <div key={op.id} className="flex flex-col">
              <Operation
                entities={entities}
                operation={op}
                operationsQueryInput={operationsQueryInput}
                user={user}
              />
            </div>
          );
        })}
      </div>
      <div className="flex w-full flex-row items-end justify-end space-x-2"></div>
    </div>
  );
};

export default OperationsFeed;
