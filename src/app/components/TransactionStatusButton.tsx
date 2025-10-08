"use client";

import type { User } from "lucia";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";

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

  const { mutateAsync } =
    api.editingOperations.updateTransactionStatus.useMutation({
      onSettled() {
        resetTxIds();
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate();
        void utils.movements.getCurrentAccounts.invalidate();
      },
    });

  const handleToast = useCallback(() => {
    if (!txIdsStore.includes(tx.id)) {
      toast.info("Lista de transacciones", {
        description: txIdsStore.join(", "),
        action: txIdsStore.length > 0 && {
          label: "Confirmar transacciones",
          onClick: () => {
            const promise = mutateAsync({ transactionIds: txIdsStore });
            toast.promise(promise, {
              loading: "Confirmando transacciones...",
              success: () => {
                resetTxIds();
                return "Transacciones confirmadas";
              },
              error: (error) => {
                return `Error al confirmar transacciones: ${error.message}`;
              },
            });
          },
        },
      });
    } else {
      toast.dismiss();
    }
  }, [txIdsStore, mutateAsync, tx.id, resetTxIds]);

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
        txIdsStore.includes(tx.id)
          ? "bg-primary text-white"
          : "bg-transparent text-black dark:text-white",
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
