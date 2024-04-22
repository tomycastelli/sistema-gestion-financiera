"use client"
import { type FC } from "react";
import { toast } from "sonner";
import UpdateTransaction from "~/app/components/forms/UpdateTransaction";
import { Icons } from "~/app/components/ui/Icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/app/components/ui/alert-dialog";
import { Button } from "~/app/components/ui/button";
import { cn } from "~/lib/utils";
import { Status } from "~/server/db/schema";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { api } from "~/trpc/react";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

interface TransactionButtonsProps {
  tx: RouterOutputs["operations"]["getOperations"]["operations"][number]["transactions"][number]
  operationsQueryInput: RouterInputs["operations"]["getOperations"]
  isInFeed: boolean;
  entities: RouterOutputs["entities"]["getFiltered"]
}

const TransactionButtons: FC<TransactionButtonsProps> = ({ tx, isInFeed, operationsQueryInput, entities }) => {
  const utils = api.useContext();
  const { txIdsStore, changeTxIds } = useOperationsPageStore();

  const { mutateAsync: cancelTransaction } =
    api.editingOperations.cancelTransaction.useMutation({
      async onMutate(newOperation) {
        // Doing the Optimistic update
        if (isInFeed) {
          await utils.operations.getOperations.cancel();

          const prevData = utils.operations.getOperations.getData();

          utils.operations.getOperations.setData(
            operationsQueryInput,
            (old) => ({
              ...old!,
              operations: old!.operations.map((item) => {
                if (item.id === tx.operationId) {
                  return {
                    ...item,
                    transactions: item.transactions.map((tx) => {
                      if (tx.id === newOperation.transactionId) {
                        return { ...tx, status: Status.enumValues[0] }
                      } else {
                        return tx;
                      }
                    }),
                  };
                } else {
                  return item;
                }
              }),
            }),
          );

          return { prevData };
        } else {
          await utils.operations.getOperations.cancel();

          utils.operations.getOperations.setData(
            { operationId: tx.operationId, limit: 1, page: 1 },
            // @ts-ignore
            (old) => ({
              ...old,
              transactions: old!.operations[0]!.transactions.map((tx) => {
                if (tx.id === newOperation.transactionId) {
                  return { ...tx, status: Status.enumValues[0] };
                } else {
                  return tx;
                }
              }),
            }),
          );
        }
      },
      onError(err, newOperation, ctx) {
        utils.operations.getOperations.setData(
          operationsQueryInput,
          ctx?.prevData,
        );

        toast.error(`No se pudo anular la transacción ${newOperation.transactionId}`, {
          description: err.message
        })
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate();
      },
      onSuccess(_, variables) {
        toast.success(`Transacción ${variables.transactionId} anulada`)
      }
    });

  return (
    <div className="flex flex-col gap-y-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="border-transparent p-1" disabled={!tx.isCancelAllowed}>
            <Icons.valueNone className="h-6 text-red" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará una transacción y movimientos para anular la
              transacción actual
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red"
              onClick={() => cancelTransaction({ transactionId: tx.id })}
            >
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button
        variant="outline"
        disabled={!tx.isValidateAllowed}
        onClick={() => {
          changeTxIds(tx.id);
        }}
        className={cn(
          "rounded-full border-2 border-transparent bg-transparent p-2",
          txIdsStore.includes(tx.id) ? "bg-primary text-white" : "bg-transparent text-black dark:text-white",
        )}
      >
        {tx.status === Status.enumValues[1] ? (
          <Icons.check className="h-8 text-green" />
        ) : tx.status === Status.enumValues[0] ? (
          <Icons.valueNone className="h-8 text-green" />
        ) : (
          <Icons.clock className="h-7" />
        )}
      </Button>
      <UpdateTransaction
        transaction={tx}
        operationsQueryInput={operationsQueryInput}
        entities={entities}
      />
    </div>
  )
}

export default TransactionButtons
