"use client";

import { type Session } from "next-auth";
import { type FC } from "react";
import Transaction from "~/app/components/Transaction";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import DetailMovementsTable from "./DetailMovementsTable";

interface OperationDetailsProps {
  initialOperations: RouterOutputs["operations"]["getOperationDetails"];
  initialEntities: RouterOutputs["entities"]["getAll"];
  operationId: string;
  session: Session;
}

const OperationDetails: FC<OperationDetailsProps> = ({
  initialOperations,
  initialEntities,
  operationId,
  session,
}) => {
  const { data: operation, isLoading } =
    api.operations.getOperationDetails.useQuery(
      { operationId: parseInt(operationId) },
      {
        initialData: initialOperations,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
      },
    );

  const { data: entities } = api.entities.getAll.useQuery(undefined, {
    initialData: initialEntities,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div>
      {isLoading ? (
        <p>Cargando...</p>
      ) : operation ? (
        <div className="mx-auto flex w-full flex-col rounded-xl border border-muted p-8 shadow-md">
          <div className="mb-4 flex flex-col">
            <h1 className="text-5xl font-bold">
              <span className="mr-2 text-4xl font-light tracking-tight text-slate-300">
                Operación
              </span>
              {operation.id}
            </h1>
            <p className="mt-2 text-lg font-light">{operation.observations}</p>
          </div>
          <div className="mx-auto flex flex-col">
            <h1 className="mx-auto mb-4 text-4xl font-semibold tracking-tighter">
              Transacciones
            </h1>
            <div className="mx-auto grid-cols-1 gap-4">
              {operation.transactions.map((tx, index) => (
                <Transaction
                  key={tx.id}
                  transaction={tx}
                  txIdx={index}
                  entities={entities}
                  operationsQueryInput={{
                    operationId: operationId,
                    limit: 1,
                    page: 1,
                  }}
                  user={session.user}
                />
              ))}
            </div>
          </div>
          <div className="mx-auto flex flex-col space-y-4">
            <h1 className="mx-auto text-4xl font-semibold tracking-tighter">
              Movimientos
            </h1>
            <DetailMovementsTable operation={operation} />
          </div>
        </div>
      ) : (
        <p>No se encontro la operacion</p>
      )}
    </div>
  );
};

export default OperationDetails;
