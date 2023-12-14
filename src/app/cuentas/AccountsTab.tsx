import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterOutputs } from "~/trpc/shared";
import Balances from "./Balances";
import MovementsTable from "./MovementsTable";

const AccountsTable = async ({
  searchParams,
  initialBalances,
  accountType,
  initialTags,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  accountType: boolean;
  initialTags: RouterOutputs["tags"]["getAll"];
}) => {
  const session = await getServerAuthSession();
  console.log(session);

  const entities = await api.entities.getAll.query();

  const selectedEntityString = searchParams.entidad as string;
  const selectedEntity = selectedEntityString
    ? parseInt(selectedEntityString)
    : undefined;
  const selectedTag = searchParams.tag as string;
  const selectedPageNumber = parseInt(searchParams.pagina as string) || 1;

  const linkId = parseInt(searchParams.id as string) || null;
  const linkToken = (searchParams.token as string) || null;

  const pageSize = 15;

  const initialMovements = await api.movements.getCurrentAccounts.query({
    linkId: linkId,
    linkToken: linkToken,
    sharedEntityId: selectedEntity,
    pageSize: pageSize,
    pageNumber: selectedPageNumber,
    entityId: selectedEntity,
    entityTag: selectedTag,
    account: accountType,
  });

  const initialDetailedBalances = await api.movements.getDetailedBalance.query({
    linkId: linkId,
    linkToken: linkToken,
    entityId: selectedEntity,
    entityTag: selectedTag,
    accountType: accountType,
  });

  return (
    <div className="flex flex-grow flex-col space-y-8">
      <Balances
        accountType={accountType}
        initialBalances={initialBalances}
        initialDetailedBalances={initialDetailedBalances}
      />
      {initialMovements.movements.length > 0 && (
        <div className="flex flex-col space-y-4">
          <h1 className="text-3xl font-semibold tracking-tighter">
            Movimientos
          </h1>
          <MovementsTable
            entities={entities}
            linkId={linkId}
            linkToken={linkToken}
            tags={initialTags}
            accountType={accountType}
            session={session}
            pageSize={pageSize}
            pageNumber={selectedPageNumber}
            initialMovements={initialMovements}
            entityTag={selectedTag}
            entityId={selectedEntity}
          />
        </div>
      )}
    </div>
  );
};

export default AccountsTable;
