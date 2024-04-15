import type { User } from "lucia";
import { memo, type FC } from "react";
import { capitalizeFirstLetter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { Status } from "~/server/db/schema";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import TransactionStatusButton from "./TransactionStatusButton";
import UpdateTransaction from "./forms/UpdateTransaction";
import EntityCard from "./ui/EntityCard";
import { Icons } from "./ui/Icons";
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
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import TransactionInfo from "../operaciones/gestion/[operationId]/TransactionInfo";

interface TransactionProps {
  transaction: RouterOutputs["operations"]["getOperations"]["operations"][number]["transactions"][number];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  user: User;
  entities: RouterOutputs["entities"]["getAll"];
  users: RouterOutputs["users"]["getAll"];
  isInFeed: boolean;
}

const Transaction: FC<TransactionProps> = ({
  transaction: tx,
  operationsQueryInput,
  user,
  entities,
  users,
  isInFeed,
}) => {
  const utils = api.useContext();

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
                    transactions: item.transactions.flatMap((tx) => {
                      if (tx.id === newOperation.transactionId) {
                        return [
                          { ...tx, status: Status.enumValues[0] },
                          {
                            ...tx,
                            fromEntityId: tx.toEntityId,
                            toEntityId: tx.fromEntityId,
                            status: Status.enumValues[0],
                          },
                        ];
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
      onSuccess(data, variables) {
        toast.success(`Transacción ${variables.transactionId} anulada`)
      }
    });

  const { mutateAsync: deleteTransaction } =
    api.operations.deleteTransaction.useMutation({
      async onMutate(newOperation) {
        // Doing the Optimistic update
        await utils.operations.getOperations.cancel();

        utils.operations.getOperations.setData(
          { operationId: tx.operationId, page: 1, limit: 1 },
          // @ts-ignore
          (old) => ({
            ...old!.operations[0],
            transactions: old!.operations[0]!.transactions.filter(
              (tx) => tx.id !== newOperation.transactionId,
            ),
          }),
        );

        const prevData = utils.operations.getOperations.getData();

        utils.operations.getOperations.setData(operationsQueryInput, (old) => ({
          ...old!,
          operations: old!.operations.map((item) => {
            if (item.id === tx.operationId) {
              return {
                ...item,
                transactions: item.transactions.filter(
                  (transaction) =>
                    transaction.id !== newOperation.transactionId,
                ),
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

        toast.error(`No se pudo eliminar la transacción ${newOperation.transactionId}`, {
          description: err.message
        })

      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate();
      },
      onSuccess(data, variables) {
        toast.success(`Transacción ${variables.transactionId} eliminada`)
      }
    });

  return (
    <div className="mb-8 grid grid-rows-2 md:grid-cols-9 md:grid-rows-1 md:gap-24 lg:gap-12">
      <div className="flex flex-row items-center space-x-2 self-start md:col-span-3 md:justify-self-end">
        <EntityCard entity={tx.operatorEntity} />
        <TransactionInfo users={users} entities={entities} tx={tx} />
      </div>
      <div className="grid grid-cols-3 justify-self-start md:col-span-3">
        <div className="justify-self-end">
          <EntityCard entity={tx.fromEntity} />
        </div>
        <div className="flex flex-col items-center space-y-2 justify-self-center">
          <div className="flex flex-col items-center space-y-0.5">
            <p className="text-muted-foreground">
              {tx.currency.toUpperCase()}{" "}
            </p>
            <p className="text-lg">
              {new Intl.NumberFormat("es-AR").format(tx.amount)}
            </p>
          </div>
          <Icons.arrowRight
            className={cn(
              "h-16",
              tx.status === Status.enumValues[0]
                ? "text-red"
                : tx.status === Status.enumValues[1]
                  ? "text-green"
                  : "",
            )}
          />
          <div className="flex w-3/4 flex-row items-center justify-center space-x-2">
            {tx.isValidateAllowed && (
              <TransactionStatusButton
                transaction={tx}
                operationsQueryInput={operationsQueryInput}
                user={user}
              />
            )}
            {tx.isUpdateAllowed && (
              <UpdateTransaction
                transaction={tx}
                operationsQueryInput={operationsQueryInput}
                entities={entities}
              />
            )}
          </div>
          <div className="5 flex flex-col items-center space-y-0">
            <p className="text-md mx-3 font-light">
              <span className="text-muted-foreground">Tx</span> {tx.id}
            </p>
            <p>{capitalizeFirstLetter(tx.type)}</p>
          </div>
        </div>
        <div className="justify-self-start">
          <EntityCard entity={tx.toEntity} />
        </div>
      </div>
      <div className="col-span-1 flex flex-col items-center space-y-2 place-self-center justify-self-start">
        {tx.isDeleteAllowed && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-transparent p-1">
                <Icons.cross className="h-6 text-red" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borrará completamente la transacción{" "}
                  <span className="font-semibold">{tx.id}</span> y los
                  movimientos relacionados
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red"
                  onClick={() => deleteTransaction({ transactionId: tx.id })}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {tx.isCancelAllowed && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-transparent p-1">
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
        )}
      </div>
    </div>
  );
};

export default memo(Transaction);

Transaction.displayName = "Transaction";
