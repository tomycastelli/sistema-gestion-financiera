"use client";

import { type Session } from "next-auth";
import { type FC } from "react";
import Operation from "~/app/components/Operation";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import DetailMovementsTable from "./DetailMovementsTable";

interface OperationDetailsProps {
  initialOperation: RouterOutputs["operations"]["getOperations"];
  entities: RouterOutputs["entities"]["getAll"];
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  operationId: string;
  session: Session;
  users: RouterOutputs["users"]["getAll"];
  movements: RouterOutputs["movements"]["getMovementsByOpId"];
}

const OperationDetails: FC<OperationDetailsProps> = ({
  movements,
  initialOperation,
  entities,
  operationId,
  session,
  users,
}) => {
  const { data, isLoading } = api.operations.getOperations.useQuery(
    { operationId: parseInt(operationId), limit: 1, page: 1 },
    {
      initialData: initialOperation,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  );

  return (
    <div>
      {isLoading ? (
        <p>Cargando...</p>
      ) : data.operations[0] ? (
        data.operations[0].isVisualizeAllowed ? (
          <div className="mx-auto flex w-full flex-col rounded-xl border border-muted p-8 shadow-md">
            <div className="mb-4 flex flex-col">
              <Operation
                operation={data.operations[0]}
                operationsQueryInput={{
                  operationId: parseInt(operationId),
                  limit: 1,
                  page: 1,
                }}
                isInFeed={false}
                users={users}
                user={session.user}
                entities={entities}
              />
            </div>
            <div className="mx-auto flex flex-col space-y-4">
              <h1 className="mx-auto text-4xl font-semibold tracking-tighter">
                Movimientos
              </h1>
              <DetailMovementsTable
                operationDate={data.operations[0].date}
                movements={movements}
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
