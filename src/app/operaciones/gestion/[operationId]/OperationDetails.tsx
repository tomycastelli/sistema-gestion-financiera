"use client";

import { type User } from "lucia";
import { type FC, useEffect } from "react";
import { toast } from "sonner";
import { useFirstRender } from "~/hooks/useFirstRender";
import { Status } from "~/server/db/schema";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import Operation from "../Operation";
import DetailMovementsTable from "./DetailMovementsTable";

interface OperationDetailsProps {
  initialOperation: RouterOutputs["operations"]["getOperations"];
  entities: RouterOutputs["entities"]["getAll"];
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  operationId: string;
  user: User;
  users: RouterOutputs["users"]["getAll"];
  initialMovements: RouterOutputs["movements"]["getMovementsByOpId"];
  mainTags: string[];
  accountingPeriodDate: Date;
}

const OperationDetails: FC<OperationDetailsProps> = ({
  initialMovements,
  initialOperation,
  entities,
  operationId,
  user,
  users,
  mainTags,
  accountingPeriodDate,
}) => {
  const { data, isLoading } = api.operations.getOperations.useQuery(
    { operationId: parseInt(operationId), limit: 1, page: 1 },
    {
      initialData: initialOperation,
      refetchOnWindowFocus: false,
    },
  );

  const utils = api.useContext();

  const { txIdsStore, resetTxIds } = useOperationsPageStore();

  const operationsQueryInput = {
    operationId: parseInt(operationId),
    page: 1,
    limit: 1,
  };

  const { mutateAsync: updateTransaction } =
    api.editingOperations.updateTransactionStatus.useMutation({
      onSettled() {
        resetTxIds();
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate();
        void utils.movements.getCurrentAccounts.invalidate();
      },
    });

  const firstRender = useFirstRender();

  useEffect(() => {
    if (firstRender) return;
    if (txIdsStore.length > 0) {
      toast.info("Lista de transacciones", {
        description: txIdsStore.join(", "),
        action: txIdsStore.length > 0 && {
          label: "Confirmar transacciones",
          onClick: () => {
            const promise = updateTransaction({ transactionIds: txIdsStore });
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
  }, [txIdsStore, updateTransaction, firstRender, resetTxIds]);

  return (
    <div>
      {isLoading ? (
        <p>Cargando...</p>
      ) : data.operations[0] ? (
        data.operations[0].isVisualizeAllowed ? (
          <div className="mx-auto flex w-full flex-col rounded-xl border border-muted p-8 shadow-md">
            <div className="grid grid-rows-2 p-4 lg:grid-cols-9 lg:grid-rows-1">
              <div className="row-span-1 lg:col-span-5"></div>
              <div className="row-span-1 grid grid-cols-3 lg:col-span-4">
                <div className="col-span-1 flex w-full flex-row items-center justify-start">
                  <p className="text-3xl font-semibold">Entrada</p>
                </div>
                <div className="col-span-1 flex flex-row items-center justify-start">
                  <p className="text-3xl font-semibold">Salida</p>
                </div>
                <div className="col-span-1"></div>
              </div>
            </div>
            <div className="mb-4 flex flex-col">
              <Operation
                accountingPeriodDate={accountingPeriodDate}
                mainTags={mainTags}
                op={data.operations[0]}
                operationsQueryInput={{
                  operationId: parseInt(operationId),
                  limit: 1,
                  page: 1,
                }}
                isInFeed={false}
                users={users}
                user={user}
                entities={entities}
              />
            </div>
            <div className="flex flex-col items-center justify-center gap-4">
              <h1 className="mx-auto text-4xl font-semibold tracking-tighter">
                Movimientos
              </h1>
              <DetailMovementsTable
                movements={initialMovements}
                operationId={parseInt(operationId)}
              />
            </div>
          </div>
        ) : (
          <p className="text-3xl font-semibold">
            El usuario no tiene los permisos para ver esta operación
          </p>
        )
      ) : (
        <p className="text-3xl font-semibold">No se encontró la operacion</p>
      )}
    </div>
  );
};

export default OperationDetails;
