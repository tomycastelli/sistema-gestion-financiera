import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import OperationDetails from "./OperationDetails";

export default async function Page({
  params,
}: {
  params: { operationId: string };
}) {
  const operationId = params.operationId;

  const operation = await api.operations.getOperations.query({
    operationId: parseInt(operationId),
    limit: 1,
    page: 1,
  });

  const entities = await api.entities.getAll.query();

  const users = await api.users.getAll.query();

  const user = await getUser();

  const userPermissions = await api.users.getAllPermissions.query();

  const movements = await api.movements.getMovementsByOpId.query({
    operationId: parseInt(operationId),
  });

  return (
    <div>
      {user && (
        <OperationDetails
          movements={movements}
          users={users}
          userPermissions={userPermissions}
          initialOperation={operation}
          operationId={operationId}
          entities={entities}
          user={user}
        />
      )}
    </div>
  );
}
