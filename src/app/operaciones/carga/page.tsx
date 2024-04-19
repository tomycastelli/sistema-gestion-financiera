import AddOperation from "~/app/components/forms/AddOperation";
import { getAllChildrenTags } from "~/lib/functions";
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

  const { data: accountingPeriodData } = await api.globalSettings.get.query({ name: "accountingPeriod" })
  const { data: mainTagData } = await api.globalSettings.get.query({ name: "mainTag" })

  const mainTag = mainTagData as { tag: string; }

  const mainTags = getAllChildrenTags(mainTag.tag, tags)

  return (
    <div className="h-full">
      {user && (
        <AddOperation
          mainTags={mainTags}
          accountingPeriodData={accountingPeriodData}
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
