"use client";

import { type Session } from "next-auth";
import { useRouter } from "next/navigation";
import { type FC } from "react";
import Transaction from "~/app/components/Transaction";
import { Icons } from "~/app/components/ui/Icons";
import { Button } from "~/app/components/ui/button";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import DetailMovementsTable from "./DetailMovementsTable";

interface OperationDetailsProps {
  initialOperations: RouterOutputs["operations"]["getOperationDetails"];
  initialEntities: RouterOutputs["entities"]["getAll"];
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  operationId: string;
  session: Session;
}

const OperationDetails: FC<OperationDetailsProps> = ({
  initialOperations,
  initialEntities,
  operationId,
  session,
}) => {
  const router = useRouter();

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
        operation.isVisualizeAllowed ? (
          <div className="mx-auto flex w-full flex-col rounded-xl border border-muted p-8 shadow-md">
            <div className="mb-4 flex flex-col">
              <div className="flex flex-row items-start justify-between">
                <div className="flex flex-col justify-start space-y-2">
                  <h1 className="text-5xl font-bold">
                    <span className="mr-2 text-4xl font-light tracking-tight text-slate-300">
                      Operación
                    </span>
                    {operation.id}
                  </h1>
                  <h3 className="text-slate-400">
                    {operation.date.toLocaleString("es-AR")}
                  </h3>
                </div>
                <Button
                  variant="outline"
                  className="border-transparent bg-transparent p-1"
                  onClick={() => router.back()}
                >
                  <Icons.undo className="h-8" />
                </Button>
              </div>
              <p className="mt-2 text-lg font-light">
                {operation.observations}
              </p>
            </div>
            <div className="mx-auto flex flex-col">
              <h1 className="mx-auto mb-4 text-4xl font-semibold tracking-tighter">
                Transacciones
              </h1>
              <div className="mx-auto grid-cols-1 gap-4">
                {operation.transactions.map((tx) => (
                  <Transaction
                    key={tx.id}
                    transaction={tx}
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
          <p>El usuario no tiene los permisos para ver esta operación</p>
        )
      ) : (
        <p>No se encontro la operacion</p>
      )}
    </div>
  );
};

export default OperationDetails;
