"use client";

import type { User } from "next-auth";
import { cn } from "~/lib/utils";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";
import { ToastAction } from "./ui/toast";
import { useToast } from "./ui/use-toast";

interface TransactionStatusButtonProps {
  transaction: RouterOutputs["operations"]["getOperations"]["operations"][number]["transactions"][number];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  user: User;
}

const TransactionStatusButton = ({
  transaction: tx,
  operationsQueryInput,
  user,
}: TransactionStatusButtonProps) => {
  const { toast } = useToast();
  const { txIdsStore, changeTxIds, resetTxIds } = useOperationsPageStore();
  const utils = api.useContext();

  enum Status {
    pending = "pending",
    confirmed = "confirmed",
    cancelled = "cancelled",
  }

  const { mutate } = api.editingOperations.updateTransactionStatus.useMutation({
    async onMutate(newOperation) {
      toast({
        title: `${newOperation.transactionIds.length}`,
        description: "Transacciones actualizadas",
        variant: "success",
      });
      resetTxIds();
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
                  status: Status.confirmed,
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
      toast({
        title: "No se pudieron actualizar las transacciones",
        description: `${JSON.stringify(err.message)}`,
        variant: "destructive",
      });
      return { prevData };
    },
    onSettled() {
      void utils.operations.getOperations.invalidate();
      void utils.movements.getMovementsByOpId.invalidate();
    },
  });

  return (
    <Button
      disabled={tx.status === Status.confirmed}
      onClick={() => {
        const txIdAdded = changeTxIds(tx.id, txIdsStore);
        const updatedTxIdsStore = txIdAdded
          ? [...txIdsStore, tx.id]
          : txIdsStore.filter((item) => item !== tx.id);
        const descriptionWord = txIdAdded ? "Añadida a" : "Eliminada de";
        toast({
          title: `Transacción ${tx.id}`,
          description: `${descriptionWord} la cola de confirmación: ${JSON.stringify(
            updatedTxIdsStore,
          )}`,
          action: (
            <ToastAction
              disabled={updatedTxIdsStore.length === 0 ? true : false}
              altText="Confirmar transacciones"
              onClick={() => {
                mutate({
                  transactionIds: updatedTxIdsStore,
                });
              }}
            >
              {updatedTxIdsStore.length > 0
                ? `Confirmar transacciones (${updatedTxIdsStore.length})`
                : "Sin transacciones para confirmar"}
            </ToastAction>
          ),
        });
      }}
      className={cn(
        "rounded-full border-2 border-transparent bg-transparent p-2",
        txIdsStore.includes(tx.id) ? "bg-primary" : "bg-transparent",
      )}
    >
      {tx.status === Status.confirmed ? (
        <Icons.check className="h-8 text-green" />
      ) : tx.status === Status.cancelled ? (
        <Icons.valueNone className="h-8 text-green" />
      ) : (
        <Icons.clock className="h-7 text-black" />
      )}
    </Button>
  );
};

export default TransactionStatusButton;
