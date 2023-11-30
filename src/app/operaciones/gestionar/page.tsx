import Link from "next/link";
import { Suspense } from "react";
import LoadingAnimation from "~/app/components/LoadingAnimation";
import OperationsFeed from "~/app/components/OperationsFeed";
import { Icons } from "~/app/components/ui/Icons";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterInputs } from "~/trpc/shared";

const Page = async ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) => {
  const session = await getServerAuthSession();

  const selectedPage = (searchParams.pagina as string) ?? "1";
  const selectedFromEntity = searchParams.origen as string;

  const operationsQueryInput: RouterInputs["operations"]["getOperations"] = {
    limit: 8,
    page: parseInt(selectedPage),
  };

  if (selectedFromEntity) {
    operationsQueryInput.fromEntityId = parseInt(selectedFromEntity);
  }

  const initialOperations = await api.operations.getOperations.query(
    operationsQueryInput,
  );

  const initialEntities = await api.entities.getAll.query();

  const userPermissions = await api.users.getAllPermissions.query({});

  return (
    <div className="flex w-full flex-col">
      <h1 className="mb-4 text-4xl font-bold tracking-tighter">Operaciones</h1>
      <Suspense fallback={<LoadingAnimation text={"Cargando operaciones"} />}>
        {session && (
          <OperationsFeed
            userPermissions={userPermissions}
            initialEntities={initialEntities}
            initialOperations={initialOperations}
            operationsQueryInput={operationsQueryInput}
            user={session.user}
          />
        )}
      </Suspense>
      <div className="flex flex-row justify-end space-x-2">
        {operationsQueryInput.page > 1 && (
          <Link
            className="flex flex-row items-center space-x-1 rounded-xl border-2 border-foreground p-2 transition-all hover:scale-110 hover:bg-slate-100"
            href={{
              pathname: "/operaciones/gestionar",
              query: { pagina: parseInt(selectedPage) - 1 },
            }}
          >
            <Icons.chevronLeft className="h-5" />
            Anterior
          </Link>
        )}
        {initialOperations.length === operationsQueryInput.limit && (
          <Link
            className="flex flex-row items-center space-x-1 rounded-xl border-2 border-foreground p-2 transition-all hover:scale-110 hover:bg-slate-100"
            href={{
              pathname: "/operaciones/gestionar",
              query: { pagina: parseInt(selectedPage) + 1 },
            }}
          >
            Siguiente <Icons.chevronRight className="h-5" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default Page;
