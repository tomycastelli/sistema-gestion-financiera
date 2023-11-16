import AddOperation from "~/app/components/forms/AddOperation";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";

const page = async () => {
  const entities = await api.entities.getAll.query();

  const session = await getServerAuthSession();

  const operations = await api.operations.getOperationsByUser.query();

  return (
    <div className="h-full">
      {session?.user && (
        <AddOperation
          entities={entities}
          user={session?.user}
          initialOperations={operations}
        />
      )}
    </div>
  );
};

export default page;
