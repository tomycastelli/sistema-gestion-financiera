"use client";

import moment from "moment";
import type { User } from "lucia";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useState, type FC } from "react";
import { cn } from "~/lib/utils";
import { Status } from "~/server/db/schema";
import { useInitialOperationStore } from "~/stores/InitialOperationStore";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import CustomPagination from "./CustomPagination";
import Transaction from "./Transaction";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { toast } from "sonner";
import ShareOperation from "../operaciones/gestion/ShareOperation";

interface OperationProps {
  operation: RouterOutputs["operations"]["getOperations"]["operations"][number];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  entities: RouterOutputs["entities"]["getAll"];
  user: User;
  users: RouterOutputs["users"]["getAll"];
  isInFeed: boolean;
}

const Operation: FC<OperationProps> = ({
  operation: op,
  operationsQueryInput,
  user,
  entities,
  users,
  isInFeed,
}) => {
  const [page, setPage] = useState<number>(1);
  const utils = api.useContext();
  const router = useRouter();

  const { setInitialOperationStore, setIsInitialOperationSubmitted } =
    useInitialOperationStore();

  const { mutateAsync: cancelAsync } =
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
              if (item.id === newOperation.operationId) {
                return {
                  ...item,
                  transactions: item.transactions.map((tx) => ({
                    ...tx,
                    status: Status.enumValues[0],
                  })),
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

        toast.error(`No se pudo elimianr la operación ${newOperation.operationId} y las transacciones relacionadas`, {
          description: JSON.stringify(err.message)
        })
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate()
      },
      onSuccess(data, variables) {
        toast.success(`Operación ${variables.operationId} y ${data.length
          } ${data.length === 1 ? "transacción" : "transacciones"
          } cancelada${data.length === 1 ? "" : "s"}`)
      }
    });

  const { mutateAsync: validateAsync } =
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

        toast.error("Las transacciones no pudieron ser actualizadas", {
          description: err.message
        })
        return { prevData };
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate()
      },
      onSuccess(data) {
        toast.success(`${data.length} transacciones actualizadas`)
      },
    });

  const { mutateAsync: deleteAsync } =
    api.operations.deleteOperation.useMutation({
      async onMutate(newOperation) {
        // Doing the Optimistic update
        await utils.operations.getOperations.cancel();

        const prevData = utils.operations.getOperations.getData();

        utils.operations.getOperations.setData(operationsQueryInput, (old) => ({
          ...old!,
          count: old!.count - 1,
          operations: old!.operations.filter(
            (item) => item.id !== newOperation.operationId,
          ),
        }));

        return { prevData };
      },
      onError(err, newOperation, ctx) {
        utils.operations.getOperations.setData(
          operationsQueryInput,
          ctx?.prevData,
        );

        toast.error(`No se pudo eliminar la operación ${newOperation.operationId} y las transacciones relacionadas`, {
          description: err.message
        })

      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate()
      },
      onSuccess(data, variables) {
        toast.success(`Operación ${variables.operationId} eliminada`)
      },
    });

  return (
    <div className="my-4 flex flex-col">
      <Card
        className={cn("shadow-xl",
          op.transactions.filter((tx) => tx.status === Status.enumValues[0])
            .length === op.transactions.length
            ? "border border-red"
            : op.transactions.filter((tx) => tx.status === Status.enumValues[1])
              .length === op.transactions.length
              ? "border border-green"
              : "",
        )}
      >
        <CardHeader>
          <CardTitle className="flex">
            <Link
              prefetch={false}
              href={`/operaciones/gestion/${op.id}`}
              className="flex flex-row space-x-1 transition-all hover:scale-125"
            >
              <p className="text-muted-foreground">Op</p>
              <p>{op.id}</p>
            </Link>
          </CardTitle>
          <CardDescription className="text-lg">
            {moment(op.date).format("DD-MM-YYYY HH:mm:ss")}
          </CardDescription>
          <CardDescription className="text-md">
            {op.observations}
          </CardDescription>
          <CardDescription>
            {op.transactions.filter((tx) => tx.status === Status.enumValues[1])
              .length === op.transactions.length
              ? "Confirmada"
              : op.transactions.filter(
                (tx) => tx.status === Status.enumValues[0],
              ).length === op.transactions.length
                ? "Cancelada"
                : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-8 mb-4 grid grid-cols-3 gap-12 text-xl font-semibold">
            <h1 className="col-span-1 justify-self-center font-semibold tracking-tighter">
              Operador
            </h1>
          </div>
          {op.transactions
            .sort((a, b) => b.id - a.id)
            .slice((page - 1) * 4, page * 4)
            .map((tx) => (
              <Transaction
                users={users}
                entities={entities}
                transaction={tx}
                key={tx.id}
                operationsQueryInput={operationsQueryInput}
                user={user}
                isInFeed={isInFeed}
              />
            ))}
          {op.transactions.length > 4 && (
            <CustomPagination
              page={page}
              pageSize={4}
              changePageState={setPage}
              totalCount={op.transactions.length}
              itemName="transacciones"
            />
          )}
        </CardContent>
        <CardFooter className="flex flex-row justify-end">
          <ShareOperation operationId={op.id} />
          {op.transactions.filter((tx) => tx.isValidateAllowed).length ===
            op.transactions.length && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="border-transparent p-2" variant="outline">
                    <Icons.check className="h-6 text-green" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se confirmarán completamente {op.transactions.length}{" "}
                      transacciones y sus movimientos relacionados
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        validateAsync({
                          transactionIds: op.transactions.flatMap((tx) => tx.id),
                        })
                      }
                      className="bg-red"
                    >
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          {op.isCreateAllowed && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="border-transparent p-2" variant="outline">
                  <Icons.plus className="h-6 text-green" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Añadir transacciones a la operación {op.id}
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setInitialOperationStore({
                        opDate: op.date,
                        opTime: moment(op.date).format("HH:mm"),
                        opObservations: op.observations
                          ? op.observations
                          : undefined,
                      });
                      setIsInitialOperationSubmitted(true);
                      router.push(`/operaciones/carga?operacion=${op.id}`);
                    }}
                    className="bg-green"
                  >
                    Añadir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {op.transactions.filter((tx) => tx.isCancelAllowed).length ===
            op.transactions.length && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="border-transparent p-2" variant="outline">
                    <Icons.valueNone className="h-6 text-red" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se crearán {op.transactions.length} transacciones y sus
                      movimientos para anular las transacciones actuales
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelAsync({ operationId: op.id })}
                      className="bg-red"
                    >
                      Anular
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          {op.transactions.filter((tx) => tx.isDeleteAllowed).length ===
            op.transactions.length && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="border-transparent p-2" variant="outline">
                    <Icons.cross className="h-6 text-red" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borraran completamente {op.transactions.length}{" "}
                      transacciones y sus movimientos relacionados
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAsync({ operationId: op.id })}
                      className="bg-red"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default memo(Operation);

Operation.displayName = "Operation";
