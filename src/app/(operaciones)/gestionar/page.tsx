import OperationsFeed from "~/app/components/OperationsFeed";
import { api } from "~/trpc/server";

const page = async () => {
  const initialOperations = await api.operations.getOperations.query({
    limit: 8,
    page: 1,
  });

  return (
    <div className="flex w-full flex-col">
      <h1 className="rounded-xl bg-primary p-4">Filtrar</h1>
      <div>
        <OperationsFeed initialOperations={initialOperations} />
      </div>
    </div>
  );
};

export default page;
