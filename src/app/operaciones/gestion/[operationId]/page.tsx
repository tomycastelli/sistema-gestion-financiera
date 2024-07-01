import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import OperationDetails from "./OperationDetails";
import { getAccountingPeriodDate, getAllChildrenTags } from "~/lib/functions";

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

  const initialMovements = await api.movements.getMovementsByOpId.query({
    operationId: parseInt(operationId),
  });

  const tags = await api.tags.getAll.query();

  const { data: mainTagData } = await api.globalSettings.get.query({
    name: "mainTag",
  });

  const mainTag = mainTagData as { tag: string };

  const mainTags = getAllChildrenTags(mainTag.tag, tags);

  const { data: accountingPeriodData } = await api.globalSettings.get.query({
    name: "accountingPeriod",
  });

  const accountingPeriod = accountingPeriodData as {
    months: number;
    graceDays: number;
  };

  const accountingPeriodDate = getAccountingPeriodDate(
    accountingPeriod.months,
    accountingPeriod.graceDays,
  );

  return (
    <div>
      {user && (
        <OperationDetails
          accountingPeriodDate={accountingPeriodDate}
          mainTags={mainTags}
          initialMovements={initialMovements}
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
