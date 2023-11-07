"use client";

import Lottie from "lottie-react";
import type { User } from "next-auth";
import { type FC } from "react";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import Operation from "./Operation";
import { Button } from "./ui/button";
import { Icons } from "./ui/icons";

interface OperationsFeedProps {
  initialOperations: RouterOutputs["operations"]["getOperations"];
  initialEntities: RouterOutputs["entities"]["getAll"];
  user: User;
}

const OperationsFeed: FC<OperationsFeedProps> = ({
  initialOperations,
  user,
  initialEntities,
}) => {
  const { pageStore, incrementPage, decrementPage } = useOperationsPageStore();

  const operationsQueryInput: RouterInputs["operations"]["getOperations"] = {
    limit: 8,
    page: pageStore,
  };

  const { data: operations, isFetching } =
    api.operations.getOperations.useQuery(operationsQueryInput, {
      initialData: initialOperations,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    });

  return (
    <div className="flex flex-col">
      <h1 className="text-3xl font-bold">{pageStore}</h1>
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
                initialEntities={initialEntities}
                operation={op}
                operationsQueryInput={operationsQueryInput}
                user={user}
              />
            </div>
          );
        })}
      </div>
      <div className="flex w-full flex-row items-end justify-end space-x-2">
        {pageStore > 1 && (
          <Button variant="outline" onClick={() => decrementPage()}>
            <Icons.chevronLeft className="h-5" />
            Anterior
          </Button>
        )}
        {operations.length === operationsQueryInput.limit && (
          <Button variant="outline" onClick={() => incrementPage()}>
            Siguiente <Icons.chevronRight className="h-5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default OperationsFeed;
