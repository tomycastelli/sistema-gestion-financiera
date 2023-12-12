import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import OperationDetails from "./OperationDetails";

export default async function Page({
  params,
}: {
  params: { operationId: string };
}) {
  const operationId = params.operationId;

  const operation = await api.operations.getOperationDetails.query({
    operationId: parseInt(operationId),
  });

  const entities = await api.entities.getAll.query();

  const users = await api.users.getAll.query();

  const session = await getServerAuthSession();

  const userPermissions = await api.users.getAllPermissions.query({});

  return (
    <div>
      {session && (
        <OperationDetails
          users={users}
          userPermissions={userPermissions}
          initialOperations={operation}
          operationId={operationId}
          initialEntities={entities}
          session={session}
        />
      )}
    </div>
  );
}
