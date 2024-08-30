"use client";

import { type User } from "lucia";
import dynamic from "next/dynamic";
import { type FC, useEffect } from "react";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { Status } from "~/server/db/schema";
import { useFirstRender } from "~/hooks/useFirstRender";
import Operation from "../operaciones/gestion/Operation";
const LoadingAnimation = dynamic(
  () => import("../components/LoadingAnimation"),
);

interface OperationsFeedProps {
  initialOperations: RouterOutputs["operations"]["getOperations"];
  users: RouterOutputs["users"]["getAll"];
  initialEntities: RouterOutputs["entities"]["getAll"];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  user: User;
  mainTags: string[];
  accountingPeriodDate: Date;
}

const OperationsFeed: FC<OperationsFeedProps> = ({
  initialOperations,
  users,
  user,
  initialEntities,
  operationsQueryInput,
  accountingPeriodDate,
  mainTags,
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

  const utils = api.useContext();

  const { mutateAsync: updateTransaction } =
    api.editingOperations.updateTransactionStatus.useMutation({
      async onMutate(newOperation) {
        // Doing the optimistic update
        await utils.operations.getOperations.cancel();

        const prevData =
          utils.operations.getOperations.getData(operationsQueryInput);

        utils.operations.getOperations.setData(operationsQueryInput, (old) => ({
          ...old!,
          operations: old!.operations.map((operation) => {
            const updatedTransactions = operation.transactions.map(
              (transaction) => {
                if (
                  newOperation.transactionIds.includes(transaction.id) &&
                  transaction.transactionMetadata
                ) {
                  return {
                    ...transaction,
                    status: Status.enumValues[1],
                    transactionMetadata: {
                      ...transaction.transactionMetadata,
                      confirmedBy: user.id,
                    },
                  };
                }
                return transaction;
              },
            );

            return {
              ...operation,
              transactions: updatedTransactions,
            };
          }),
        }));

        return { prevData };
      },
      onError(err) {
        const prevData =
          utils.operations.getOperations.getData(operationsQueryInput);
        // Doing some ui actions
        toast.error("No se pudo actualizar", {
          description: err.message,
        });
        return { prevData };
      },
      onSettled() {
        resetTxIds();
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate();
        void utils.movements.getCurrentAccounts.invalidate();
        void utils.movements.getBalancesByEntities.invalidate();
        void utils.movements.getBalancesByEntitiesForCard.invalidate();
      },
      onSuccess(data) {
        const title =
          data.length > 1
            ? data.length.toString() + " transacciones actualizadas"
            : " 1 transacción actualizada";
        toast.success(title);
      },
    });

  const { txIdsStore, resetTxIds } = useOperationsPageStore();

  const firstRender = useFirstRender();

  useEffect(() => {
    if (firstRender) return;
    if (txIdsStore.length > 0) {
      toast.info("Lista de transacciones", {
        description: txIdsStore.join(", "),
        action: txIdsStore.length > 0 && {
          label: "Confirmar transacciones",
          onClick: () => void updateTransaction({ transactionIds: txIdsStore }),
        },
      });
    } else {
      toast.dismiss();
    }
  }, [txIdsStore, updateTransaction, firstRender]);

  return (
    <div className="my-4 flex flex-col">
      <Button
        tooltip="Recargar operaciones"
        className="flex w-min"
        variant="outline"
        onClick={() => refetch()}
      >
        <Icons.reload className="ml-2 h-5" />
      </Button>
      <div className="flex flex-col gap-y-4">
        <div className="grid grid-rows-2 p-4 lg:grid-cols-9 lg:grid-rows-1">
          <div className="row-span-1 lg:col-span-5"></div>
          <div className="row-span-1 grid grid-cols-3 lg:col-span-4">
            <div className="col-span-1 flex w-full flex-row items-center justify-start">
              <p className="text-3xl font-semibold">Entrada</p>
            </div>
            <div className="col-span-1 flex flex-row items-center justify-start">
              <p className="text-3xl font-semibold">Salida</p>
            </div>
            <div className="col-span-1"></div>
          </div>
        </div>
        {isRefetching ? (
          <LoadingAnimation text={"Cargando operaciones"} />
        ) : data.operations.length > 0 ? (
          data.operations
            .filter((op) => op.isVisualizeAllowed)
            .map((op) => {
              return (
                <Operation
                  accountingPeriodDate={accountingPeriodDate}
                  key={op.id}
                  users={users}
                  entities={entities}
                  isInFeed={true}
                  operationsQueryInput={operationsQueryInput}
                  user={user}
                  op={op}
                  mainTags={mainTags}
                />
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
