"use client";

import { Status } from "@prisma/client";
import moment from "moment";
import type { User } from "next-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useState, type FC } from "react";
import { cn } from "~/lib/utils";
import { useInitialOperationStore } from "~/stores/InitialOperationStore";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
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
import { Input } from "./ui/input";
import { toast } from "./ui/use-toast";

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
        toast({
          title: `Operación ${newOperation.operationId} y ${
            op.transactions.length
          } ${
            op.transactions.length === 1 ? "transacción" : "transacciones"
          } cancelada${op.transactions.length === 1 ? "" : "s"}`,
          variant: "success",
        });

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
                    status: "cancelled",
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

        // Doing some ui actions
        toast({
          title:
            "No se pudo anular la operación y las transacciones relacionadas",
          description: `${JSON.stringify(err.data)}`,
          variant: "destructive",
        });
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
      },
    });

  const { mutateAsync: validateAsync } =
    api.editingOperations.updateTransactionStatus.useMutation({
      async onMutate(newOperation) {
        toast({
          title: `${newOperation.transactionIds.length}`,
          description: "Transacciones actualizadas",
          variant: "success",
        });

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
          description: `${JSON.stringify(err.data)}`,
          variant: "destructive",
        });
        return { prevData };
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
      },
    });

  const { mutateAsync: deleteAsync } =
    api.operations.deleteOperation.useMutation({
      async onMutate(newOperation) {
        toast({
          title: `Operación ${newOperation.operationId} y ${
            op.transactions.length
          } ${
            op.transactions.length === 1 ? "transacción" : "transacciones"
          } eliminada${op.transactions.length === 1 ? "" : "s"}`,
          variant: "success",
        });

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

        // Doing some ui actions
        toast({
          title:
            "No se pudo eliminar la operación y las transacciones relacionadas",
          description: `${JSON.stringify(err.data)}`,
          variant: "destructive",
        });
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
      },
    });

  return (
    <div className="my-4 flex flex-col">
      <Card
        className={cn(
          op.transactions.filter((tx) => tx.status === Status.cancelled)
            .length === op.transactions.length
            ? "border border-red"
            : op.transactions.filter((tx) => tx.status === Status.confirmed)
                .length === op.transactions.length
            ? "border border-green"
            : "",
        )}
      >
        <CardHeader>
          <CardTitle className="flex">
            <Link
              href={`/operaciones/gestion/${op.id}`}
              className="flex flex-row space-x-1 text-black transition-all hover:scale-125"
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
            {op.transactions.filter((tx) => tx.status === "confirmed")
              .length === op.transactions.length
              ? "Confirmada"
              : op.transactions.filter((tx) => tx.status === "cancelled")
                  .length === op.transactions.length
              ? "Cancelada"
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-8 mb-4 grid grid-cols-3 gap-12 text-xl font-semibold text-black">
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
            <div className="flex flex-row items-center justify-end space-x-2 ">
              {page > 1 && (
                <Button
                  className="flex p-2"
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                >
                  <Icons.chevronLeft className="h-4" />
                </Button>
              )}
              <Input
                className="w-12"
                value={page}
                onChange={(e) => {
                  const pageNumber = parseInt(e.target.value);
                  if (pageNumber > op.transactions.length / 4) {
                    setPage(page);
                  } else if (pageNumber < 1 || isNaN(pageNumber)) {
                    setPage(1);
                  } else {
                    setPage(pageNumber);
                  }
                }}
              />
              {Math.round(op.transactions.length / 4) > page && (
                <Button
                  className="flex p-2"
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                >
                  <Icons.chevronRight className="h-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-row justify-end">
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
                    Anular
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
                    Se anularán completamente {op.transactions.length}{" "}
                    transacciones y sus movimientos relacionados
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
