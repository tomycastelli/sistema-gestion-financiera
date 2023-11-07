import { Suspense } from "react";
import LoadingAnimation from "~/app/components/LoadingAnimation";
import OperationsFeed from "~/app/components/OperationsFeed";
import FilterOperationsForm from "~/app/components/forms/FilterOperationsForm";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";

const Page = async () => {
  const session = await getServerAuthSession();

  const initialOperations = await api.operations.getOperations.query({
    limit: 8,
    page: 1,
  });

  const initialEntities = await api.entities.getAll.query();

  return (
    <div className="flex w-full flex-col">
      <div>
        <h1 className="text-4xl font-bold tracking-tighter">Operaciones</h1>
        <FilterOperationsForm />
      </div>
      <Suspense fallback={<LoadingAnimation text={"Cargando operaciones"} />}>
        {session && (
          <OperationsFeed
            initialEntities={initialEntities}
            initialOperations={initialOperations}
            user={session.user}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Page;
