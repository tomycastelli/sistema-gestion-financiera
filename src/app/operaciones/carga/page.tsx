import AddOperation from "~/app/components/forms/AddOperation";
import { getAccountingPeriodDate, getAllChildrenTags } from "~/lib/functions";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";

const Page = async () => {
  const initialEntities = await api.entities.getFiltered.query({
    permissionName: "OPERATIONS_CREATE",
  });

  const user = await getUser();

  const operations = await api.operations.getOperationsByUser.query();

  const userPermissions = await api.users.getAllPermissions.query();

  const tags = await api.tags.getAll.query();

  const { data: mainTagData } = await api.globalSettings.get.query({ name: "mainTag" })

  const mainTag = mainTagData as { tag: string; }

  const mainTags = getAllChildrenTags(mainTag.tag, tags)

  const { data: accountingPeriodData } = await api.globalSettings.get.query({ name: "accountingPeriod" })

  const accountingPeriod = accountingPeriodData as { months: number; graceDays: number; }

  const accountingPeriodDate = getAccountingPeriodDate(accountingPeriod.months, accountingPeriod.graceDays)

  return (
    <div className="h-full">
      {user && (
        <AddOperation
          mainTags={mainTags}
          accountingPeriodDate={accountingPeriodDate}
          tags={tags}
          userPermissions={userPermissions}
          initialEntities={initialEntities}
          user={user}
          initialOperations={operations}
        />
      )}
    </div>
  );
};

export default Page;
