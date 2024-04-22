"use client";

import type { User } from "lucia";
import { cn } from "~/lib/utils";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useCallback, useEffect } from "react";

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
  const { txIdsStore, changeTxIds, resetTxIds } = useOperationsPageStore();
  const utils = api.useContext();

  enum Status {
    pending = "pending",
    confirmed = "confirmed",
    cancelled = "cancelled",
  }

  const { mutate } = api.editingOperations.updateTransactionStatus.useMutation({
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
      toast.error("No se pudo actualizar", {
        description: err.message
      })
      return { prevData };
    },
    onSettled() {
      resetTxIds();
      void utils.operations.getOperations.invalidate();
      void utils.movements.getMovementsByOpId.invalidate();
      void utils.movements.getCurrentAccounts.invalidate();
    },
    onSuccess(data) {
      const title = data.length > 1 ? data.length.toString() + " transacciones actualizadas" : " 1 transacción actualizada"
      toast.success(title)
    }
  });



  const handleToast = useCallback(() => {
    if (!txIdsStore.includes(tx.id)) {
      toast.info("Lista de transacciones", {
        description: txIdsStore.join(", "),
        action: txIdsStore.length > 0 && {
          label: "Confirmar transacciones",
          onClick: () => mutate({ transactionIds: txIdsStore }),
        }
      })
    } else {
      toast.dismiss()
    }
  }, [txIdsStore, mutate, tx.id])

  useEffect(() => {
    handleToast();
  }, [txIdsStore, handleToast]);

  return (
    <Button
      disabled={tx.status === Status.confirmed}
      onClick={() => {
        changeTxIds(tx.id);
      }}
      className={cn(
        "rounded-full border-2 border-transparent bg-transparent p-2",
        txIdsStore.includes(tx.id) ? "bg-primary text-white" : "bg-transparent text-black dark:text-white",
      )}
    >
      {tx.status === Status.confirmed ? (
        <Icons.check className="h-8 text-green" />
      ) : tx.status === Status.cancelled ? (
        <Icons.valueNone className="h-8 text-green" />
      ) : (
        <Icons.clock className="h-7" />
      )}
    </Button>
  );
};

export default TransactionStatusButton;
