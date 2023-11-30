"use client";

import type { User } from "next-auth";
import Link from "next/link";
import type { FC } from "react";
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
import { toast } from "./ui/use-toast";

interface OperationProps {
  operation: RouterOutputs["operations"]["getOperations"][number];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  entities: RouterOutputs["entities"]["getAll"];
  user: User;
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
}

const Operation: FC<OperationProps> = ({
  operation: op,
  operationsQueryInput,
  user,
  entities,
  userPermissions,
}) => {
  function isTransactionAllowed(
    operation: typeof op,
    allowedNumbers?: number[],
    allowedStrings?: string[],
  ): boolean {
    for (const transaction of operation.transactions) {
      if (allowedNumbers) {
        if (
          allowedNumbers.includes(transaction.fromEntityId) ||
          allowedNumbers.includes(transaction.toEntityId) ||
          allowedNumbers.includes(transaction.operatorEntityId)
        ) {
          return true; // At least one transaction number is allowed
        }
      }
      if (allowedStrings) {
        if (
          allowedStrings.includes(transaction.fromEntity.tagName) ||
          allowedStrings.includes(transaction.toEntity.tagName) ||
          allowedStrings.includes(transaction.operatorEntity.tagName)
        ) {
          return true;
        }
      }
    }
    return false; // None of the transaction numbers are allowed
  }

  const utils = api.useContext();

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

        utils.operations.getOperations.setData(operationsQueryInput, (old) => [
          // @ts-ignore
          ...old?.filter((item) => item.id !== newOperation.operationId),
        ]);

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
      <Card>
        <CardHeader>
          <CardTitle className="flex">
            <Link
              href={`/operaciones/gestionar/${op.id}`}
              className="flex text-black transition-all hover:scale-125"
            >
              {op.id}
            </Link>
          </CardTitle>
          <CardDescription className="text-lg">
            {op.date.toLocaleString("es-AR")}
          </CardDescription>
          <CardDescription>{op.observations}</CardDescription>
        </CardHeader>
        <CardContent>
          {op.transactions
            .sort((a, b) => b.id - a.id)
            .map((tx, txIdx) => (
              <Transaction
                userPermissions={userPermissions}
                entities={entities}
                transaction={tx}
                key={tx.id}
                operationsQueryInput={operationsQueryInput}
                txIdx={txIdx}
                user={user}
              />
            ))}
        </CardContent>
        <CardFooter className="flex flex-row justify-end">
          {userPermissions?.find(
            (permission) =>
              permission.name === "ADMIN" ||
              permission.name === "TRANSACTIONS_DELETE" ||
              (permission.name === "TRANSACTIONS_DELETE_SOME" &&
                isTransactionAllowed(
                  op,
                  permission.entitiesIds,
                  permission.entitiesTags,
                )),
          ) && (
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

export default Operation;
