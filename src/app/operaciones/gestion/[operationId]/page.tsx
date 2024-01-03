import { getServerAuthSession } from "~/server/auth";
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

  const session = await getServerAuthSession();

  const userPermissions = await api.users.getAllPermissions.query({});

  const movements = await api.movements.getMovementsByOpId.query({
    operationId: parseInt(operationId),
  });

  return (
    <div>
      {session && (
        <OperationDetails
          movements={movements}
          users={users}
          userPermissions={userPermissions}
          initialOperation={operation}
          operationId={operationId}
          entities={entities}
          session={session}
        />
      )}
    </div>
  );
}
