import AddOperation from "~/app/components/forms/AddOperation";
import { getAllChildrenTags } from "~/lib/functions";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";

const Page = async () => {
  const entities = await api.entities.getAll.query();

  const session = await getServerAuthSession();

  const operations = await api.operations.getOperationsByUser.query();

  const userPermissions = await api.users.getAllPermissions.query({});

  const tags = await api.tags.getAll.query();

  const filteredEntities = entities.filter((entity) => {
    if (
      userPermissions?.find(
        (p) => p.name === "ADMIN" || p.name === "OPERATIONS_CREATE",
      )
    ) {
      return true;
    } else if (
      userPermissions?.find(
        (p) =>
          p.name === "OPERATIONS_CREATE_SOME" &&
          (p.entitiesIds?.includes(entity.id) ||
            getAllChildrenTags(p.entitiesTags, tags).includes(
              entity.tag.name,
            ) ||
            entity.name === session?.user.name),
      )
    ) {
      return true;
    }
  });

  return (
    <div className="h-full">
      {session?.user && (
        <AddOperation
          tags={tags}
          userPermissions={userPermissions}
          initialEntities={filteredEntities}
          user={session?.user}
          initialOperations={operations}
        />
      )}
    </div>
  );
};

export default Page;
