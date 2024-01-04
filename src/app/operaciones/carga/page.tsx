import AddOperation from "~/app/components/forms/AddOperation";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";

const Page = async () => {
  const initialEntities = await api.entities.getFiltered.query({
    permissionName: "OPERATIONS_CREATE",
  });

  const session = await getServerAuthSession();

  const operations = await api.operations.getOperationsByUser.query();

  const userPermissions = await api.users.getAllPermissions.query({});

  const tags = await api.tags.getAll.query();

  return (
    <div className="h-full">
      {session?.user && (
        <AddOperation
          tags={tags}
          userPermissions={userPermissions}
          initialEntities={initialEntities}
          user={session?.user}
          initialOperations={operations}
        />
      )}
    </div>
  );
};

export default Page;
