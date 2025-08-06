"use client";
import dynamic from "next/dynamic";
import { type FC } from "react";
import { toast } from "sonner";
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
const UpdateTransaction = dynamic(
  () => import("~/app/components/forms/UpdateTransaction"),
);

interface TransactionButtonsProps {
  tx: RouterOutputs["operations"]["getOperations"]["operations"][number]["transactions"][number];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  entities: RouterOutputs["entities"]["getFiltered"];
}

const TransactionButtons: FC<TransactionButtonsProps> = ({
  tx,
  operationsQueryInput,
  entities,
}) => {
  const { txIdsStore, changeTxIds } = useOperationsPageStore();

  const utils = api.useContext();

  const { mutateAsync: cancelAsync, isLoading } =
    api.editingOperations.cancelTransaction.useMutation({
      async onMutate(newOperation) {
        // Doing the Optimistic update
        await utils.operations.getOperations.cancel();

        const prevData = utils.operations.getOperations.getData();

        utils.operations.getOperations.setData(operationsQueryInput, (old) => ({
          ...old!,
          operations:
            // @ts-ignore
            old!.operations.map((item) => {
              if (item.id === tx.operationId) {
                return {
                  ...item,
                  transactions: item.transactions
                    .map((tx) => {
                      if (newOperation.transactionsId!.includes(tx.id)) {
                        return { ...tx, status: Status.enumValues[0] };
                      } else {
                        return tx;
                      }
                    })
                    .flat(),
                };
              } else {
                return item;
              }
            }),
        }));

        return { prevData };
      },
      onError(err, newOperation, ctx) {
        utils.operations.getOperations.setData(
          operationsQueryInput,
          ctx?.prevData,
        );

        toast.error(
          `No se pudo cancelar la transacciones ${newOperation.transactionsId?.join(
            ", ",
          )}`,
          {
            description: JSON.stringify(err.message),
          },
        );
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate();
        void utils.movements.getCurrentAccounts.invalidate();
        void utils.movements.getBalancesByEntities.invalidate();
      },
      onSuccess(data) {
        toast.success(
          `${data.length === 1 ? "Transacción" : "Transacciones"} cancelada${
            data.length === 1 ? "" : "s"
          }`,
        );
      },
    });

  return (
    <div className="flex flex-col gap-y-1">
      <Button
        variant="outline"
        disabled={!tx.isValidateAllowed}
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
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="border-transparent p-2"
            variant="outline"
            disabled={!tx.isCancelAllowed}
          >
            <Icons.valueNone className="h-6 text-red" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              {tx.transactionMetadata.relatedTransactionId
                ? `Se crearán movimientos invertidos para anular la transacciones
              relacionadas: ${tx.id} y
              ${tx.transactionMetadata.relatedTransactionId}`
                : `Se crearán movimientos invertidos para anular la transacción ${tx.id}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isLoading}
              onClick={async () => {
                const ids = [tx.id];
                if (tx.transactionMetadata.relatedTransactionId) {
                  ids.push(tx.transactionMetadata.relatedTransactionId);
                }
                await cancelAsync({
                  transactionsId: ids,
                });
              }}
              className="bg-red"
            >
              Cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TransactionButtons;
