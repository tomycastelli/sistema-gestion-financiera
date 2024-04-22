"use client"

import React, { useState, type FC } from 'react'
import { api } from '~/trpc/react'
import { type RouterInputs, type RouterOutputs } from '~/trpc/shared'
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
import { toast } from 'sonner';
import { Status } from '~/server/db/schema';
import { type User } from 'lucia';
import ShareOperation from './ShareOperation';
import { Button } from '~/app/components/ui/button';
import { Icons } from '~/app/components/ui/Icons';
import { useInitialOperationStore } from '~/stores/InitialOperationStore';
import { useRouter } from 'next/navigation';
import moment from 'moment';
import UpdateOperation from './UpdateOperation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/app/components/ui/collapsible';

interface OperationButtonsProps {
  op: RouterOutputs["operations"]["getOperations"]["operations"][number]
  operationsQueryInput: RouterInputs["operations"]["getOperations"]
  user: User
  accountingPeriodDate: Date
}

const OperationButtons: FC<OperationButtonsProps> = ({ op, operationsQueryInput, user, accountingPeriodDate }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const router = useRouter()

  const { setIsInitialOperationSubmitted, setInitialOperationStore } = useInitialOperationStore()

  const utils = api.useContext()

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
        void utils.movements.getCurrentAccounts.invalidate()
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
        toast.success(data.length.toString() + " " + "transacciones actualizadas")
      },
    });


  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className='flex flex-row-reverse'>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className='border-transparent p-2'>
          <Icons.horizontalDots className='h-6 w-6' />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        className='flex flex-row gap-x-2 items-center overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up'>
        <UpdateOperation
          operationsQueryInput={operationsQueryInput}
          opId={op.id}
          accountingPeriodDate={accountingPeriodDate}
          opObservations={op.observations}
          opDate={op.date} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="border-transparent p-2" variant="outline" disabled={op.transactions.filter((tx) => tx.isValidateAllowed).length !== op.transactions.length}>
              <Icons.check className="h-6 text-green" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Se confirmarán completamente {op.transactions.filter(tx => tx.isValidateAllowed).length}{" "}
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
                className="bg-green"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="border-transparent p-2" variant="outline" disabled={!op.isCreateAllowed}>
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="border-transparent p-2" variant="outline" disabled={op.transactions.filter((tx) => tx.isCancelAllowed).length !== op.transactions.length}>
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
        <ShareOperation operationId={op.id} />
      </CollapsibleContent>
    </Collapsible>
  )
}

export default OperationButtons
