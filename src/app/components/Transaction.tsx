import moment from "moment";
import type { User } from "lucia";
import { memo, type FC } from "react";
import { z } from "zod";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { toast } from "sonner";

interface TransactionProps {
  transaction: RouterOutputs["operations"]["getOperations"]["operations"][number]["transactions"][number];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  user: User;
  entities: RouterOutputs["entities"]["getAll"];
  users: RouterOutputs["users"]["getAll"];
  isInFeed: boolean;
}

const ChangeData = z.object({
  key: z.string(),
  after: z.union([z.number(), z.string()]),
  before: z.union([z.number(), z.string()]),
});

const ChangeObject = z.object({
  changeData: z.array(ChangeData),
  changeDate: z.string(), // Assuming changeDate is a string, adjust if it has a different type
  changedBy: z.string(),
});

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
        <div>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="link">
                <Icons.info className="h-8" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-68 flex flex-col space-y-1">
              {
                // @ts-ignore
                tx.transactionMetadata?.metadata &&
                // @ts-ignore
                tx.transactionMetadata.metadata.exchangeRate && (
                  <p className="rounded-xl border border-muted-foreground p-2 shadow-md">
                    Cambio:{" "}
                    <span className="font-semibold">
                      {// @ts-ignore
                        tx.transactionMetadata?.metadata.exchangeRate.toString()}
                    </span>
                  </p>
                )
              }
              <div className="flex flex-col rounded-xl border border-muted-foreground p-2 shadow-md">
                <p className="font-semibold">
                  {moment(tx.transactionMetadata?.uploadedDate).format(
                    "DD-MM-YYYY HH:mm:ss",
                  )}
                </p>
                <p>
                  Cargado por:{" "}
                  <span className="font-semibold">
                    {tx.transactionMetadata?.uploadedByUser.name}
                  </span>{" "}
                </p>
              </div>
              {tx.transactionMetadata?.confirmedByUser && (
                <div className="flex flex-col rounded-xl border border-muted-foreground p-2 shadow-md">
                  <p className="font-semibold">
                    {moment(tx.transactionMetadata.confirmedDate).format(
                      "DD-MM-YYYY HH:mm:ss",
                    )}
                  </p>
                  <p>
                    Confirmado por:{" "}
                    <span className="font-semibold">
                      {tx.transactionMetadata?.confirmedByUser?.name}
                    </span>{" "}
                  </p>
                </div>
              )}
              {tx.transactionMetadata?.cancelledByUser?.name && (
                <div className="flex flex-col rounded-xl border border-muted-foreground p-2 shadow-md">
                  <p className="font-semibold">
                    {moment(tx.transactionMetadata.cancelledDate).format(
                      "DD-MM-YYYY HH:mm:ss",
                    )}
                  </p>
                  <p>
                    Cancelado por:{" "}
                    <span className="font-semibold">
                      {tx.transactionMetadata?.cancelledByUser.name}
                    </span>{" "}
                  </p>
                </div>
              )}
              <div className="flex flex-col space-y-2">
                {tx.transactionMetadata?.history && (
                  <p className="mb-1 mt-2 font-semibold">Cambios</p>
                )}
                {tx.transactionMetadata?.history &&
                  tx.transactionMetadata?.history
                    // @ts-ignore
                    .sort((a, b) => {
                      const dateA = new Date(a.changeDate).getTime();
                      const dateB = new Date(b.changeDate).getTime();
                      return dateB - dateA;
                    })
                    .map((item: z.infer<typeof ChangeObject>) => (
                      <div
                        key={item.changeDate}
                        className="rounded-xl border border-muted-foreground p-2 shadow-md"
                      >
                        <h2 className="text-md font-semibold">
                          {new Date(item.changeDate).toLocaleString("es-AR")}
                        </h2>
                        <h3 className="text-md">
                          {users.find((u) => u.id === item.changedBy)?.name}
                        </h3>
                        <div className="mt-2 flex flex-col space-y-1">
                          {item.changeData.map((change) => (
                            <div key={change.key}>
                              {change.key === "amount" && (
                                <div className="flex flex-row items-center space-x-2">
                                  <Icons.money className="h-6" />
                                  <p className="font-light">
                                    {new Intl.NumberFormat("es-AR").format(
                                      // @ts-ignore
                                      change.before,
                                    )}
                                  </p>
                                  <Icons.chevronRight className="h-4" />
                                  <p className="font-semibold">
                                    {new Intl.NumberFormat("es-AR").format(
                                      // @ts-ignore
                                      change.after,
                                    )}
                                  </p>
                                </div>
                              )}
                              {change.key === "currency" && (
                                <div className="flex flex-row items-center space-x-2">
                                  <Icons.currencyExchange className="h-6" />
                                  <p className="font-light">
                                    {change.before.toString().toUpperCase()}
                                  </p>
                                  <Icons.chevronRight className="h-4" />
                                  <p className="font-semibold">
                                    {change.after.toString().toUpperCase()}
                                  </p>
                                </div>
                              )}
                              {[
                                "operatorEntityId",
                                "fromEntityId",
                                "toEntityId",
                              ].includes(change.key) && (
                                  <div className="flex flex-row items-center space-x-2">
                                    <Icons.person className="h-6" />
                                    <p className="font-light">
                                      {
                                        entities.find(
                                          (entity) => change.before === entity.id,
                                        )?.name
                                      }
                                    </p>
                                    <Icons.chevronRight className="h-4" />
                                    <p className="font-semibold">
                                      {
                                        entities.find(
                                          (entity) => change.after === entity.id,
                                        )?.name
                                      }
                                    </p>
                                  </div>
                                )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
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
            {tx.isUpdateAllowed && tx.status === Status.enumValues[2] && (
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
