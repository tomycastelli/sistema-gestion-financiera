import { Status } from "@prisma/client";
import type { User } from "next-auth";
import type { FC } from "react";
import { z } from "zod";
import { capitalizeFirstLetter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currentAccountOnlyTypes } from "~/lib/variables";
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
import { toast } from "./ui/use-toast";

interface TransactionProps {
  transaction: RouterOutputs["operations"]["getOperations"][number]["transactions"][number];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  user: User;
  entities: RouterOutputs["entities"]["getAll"];
  users: RouterOutputs["users"]["getAll"];
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
}) => {
  const utils = api.useContext();

  const { mutateAsync: cancelTransaction } =
    api.editingOperations.cancelTransaction.useMutation({
      async onMutate(newOperation) {
        toast({
          title: `Transacción ${newOperation.transactionId} anulada`,
          variant: "success",
        });
        // Doing the Optimistic update
        await utils.operations.getOperations.cancel();

        await utils.operations.getOperationDetails.cancel();

        utils.operations.getOperationDetails.setData(
          { operationId: tx.operationId },
          // @ts-ignore
          (old) => ({
            ...old,
            transactions: old?.transactions.map((tx) => {
              if (tx.id === newOperation.transactionId) {
                return { ...tx, status: "cancelled" };
              } else {
                return tx;
              }
            }),
          }),
        );

        const prevData = utils.operations.getOperations.getData();

        utils.operations.getOperations.setData(
          operationsQueryInput,
          (old) =>
            old?.map((item) => {
              if (item.id === tx.operationId) {
                return {
                  ...item,
                  transactions: item.transactions.map((tx) => {
                    if (tx.id === newOperation.transactionId) {
                      return { ...tx, status: "cancelled" };
                    } else {
                      return tx;
                    }
                  }),
                };
              } else {
                return item;
              }
            }),
        );

        return { prevData };
      },
      onError(err, newOperation, ctx) {
        utils.operations.getOperations.setData(
          operationsQueryInput,
          ctx?.prevData,
        );

        // Doing some ui actions
        toast({
          title: `No se pudo anular la transacción ${newOperation.transactionId}`,
          description: `${JSON.stringify(err.data)}`,
          variant: "destructive",
        });
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.operations.getOperationDetails.invalidate();
      },
    });

  const { mutateAsync: deleteTransaction } =
    api.operations.deleteTransaction.useMutation({
      async onMutate(newOperation) {
        toast({
          title: `Transacción ${newOperation.transactionId} eliminada`,
          variant: "success",
        });
        // Doing the Optimistic update
        await utils.operations.getOperations.cancel();

        await utils.operations.getOperationDetails.cancel();

        utils.operations.getOperationDetails.setData(
          { operationId: tx.operationId },
          // @ts-ignore
          (old) => ({
            ...old,
            transactions: old?.transactions.filter(
              (tx) => tx.id !== newOperation.transactionId,
            ),
          }),
        );

        const prevData = utils.operations.getOperations.getData();

        utils.operations.getOperations.setData(
          operationsQueryInput,
          (old) =>
            old?.map((item) => {
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
        );

        return { prevData };
      },
      onError(err, newOperation, ctx) {
        utils.operations.getOperations.setData(
          operationsQueryInput,
          ctx?.prevData,
        );

        // Doing some ui actions
        toast({
          title: `No se pudo eliminar la transacción ${newOperation.transactionId}`,
          description: `${JSON.stringify(err.data)}`,
          variant: "destructive",
        });
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.operations.getOperationDetails.invalidate();
      },
    });

  return (
    <div className="mb-8 grid grid-cols-9 gap-8">
      <div className="col-span-3 flex flex-row items-center space-x-2 self-start justify-self-end">
        <EntityCard entity={tx.operatorEntity} />
        <div>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="link" className="text-black">
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
                  {tx.transactionMetadata?.uploadedDate.toLocaleString("es-AR")}
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
                    {tx.transactionMetadata?.confirmedDate?.toLocaleString(
                      "es-AR",
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
                    {tx.transactionMetadata?.cancelledDate?.toLocaleString(
                      "es-AR",
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
                                  <Icons.money className="h-6 text-black" />
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
                                  <Icons.currencyExchange className="h-6 text-black" />
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
                                  <Icons.person className="h-6 text-black" />
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
      <div className="col-span-3 grid grid-cols-3 justify-self-start">
        <div className="justify-self-end">
          <EntityCard entity={tx.fromEntity} />
        </div>
        <div className="flex flex-col items-center space-y-2 justify-self-center">
          <p className="text-muted-foreground">
            {tx.currency.toUpperCase()}{" "}
            <span className="text-black">
              {new Intl.NumberFormat("es-AR").format(tx.amount)}
            </span>{" "}
          </p>
          <Icons.arrowRight
            className={cn(
              "h-16",
              tx.status === Status.cancelled
                ? "text-red"
                : tx.status === Status.confirmed
                ? "text-green"
                : tx.status === Status.pending
                ? "text-black"
                : "",
            )}
          />
          <div className="flex w-3/4 flex-row items-center justify-center space-x-2">
            {!currentAccountOnlyTypes.includes(tx.type) &&
              tx.isValidateAllowed &&
              tx.status === Status.pending && (
                <TransactionStatusButton
                  transaction={tx}
                  operationsQueryInput={operationsQueryInput}
                  user={user}
                />
              )}
            {tx.isUpdateAllowed && tx.status === Status.pending && (
              <UpdateTransaction
                transaction={tx}
                operationsQueryInput={operationsQueryInput}
                entities={entities}
              />
            )}
          </div>
          <p className="text-md mx-3 font-light text-muted-foreground">
            Tx <span className="text-black">{tx.id}</span> /{" "}
            {capitalizeFirstLetter(tx.type)}
          </p>
        </div>
        <div className="justify-self-start">
          <EntityCard entity={tx.toEntity} />
        </div>
      </div>
      <div className="col-span-1 flex flex-col items-center space-y-2 place-self-center justify-self-start">
        {tx.isDeleteAllowed &&
          tx.status !== Status.cancelled &&
          tx.status !== Status.confirmed && (
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
                    Se borrará completamente la transacción y los movimientos
                    relacionados
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
        {tx.isCancelAllowed &&
          tx.status !== Status.cancelled &&
          tx.status !== Status.confirmed && (
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
                    Se anularán completamente la transacción y los movimientos
                    relacionados
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

export default Transaction;
