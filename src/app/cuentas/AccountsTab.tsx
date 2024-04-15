import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterOutputs } from "~/trpc/shared";
import dynamic from "next/dynamic";

const Balances = dynamic(() => import("./Balances"), { ssr: false });
const MovementsTable = dynamic(() => import("./MovementsTable"));

const AccountsTable = async ({
  initialBalances,
  accountType,
  initialTags,
  linkId,
  linkToken,
  entityId,
  entityTag,
  uiColor
}: {
  searchParams: Record<string, string | string[] | undefined>;
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  accountType: boolean;
  initialTags: RouterOutputs["tags"]["getAll"];
  linkId: number | null;
  linkToken: string | null;
  entityId: number | undefined;
  entityTag: string | undefined;
  uiColor: string | undefined
}) => {
  const user = await getUser();

  const entities = await api.entities.getAll.query();

  const pageSize = 20;

  const initialMovements = await api.movements.getCurrentAccounts.query({
    linkId: linkId,
    linkToken: linkToken,
    sharedEntityId: entityId,
    pageSize: pageSize,
    pageNumber: 1,
    entityId: entityId,
    entityTag: entityTag,
    account: accountType,
  });

  return (
    <div className="flex flex-grow flex-col space-y-8">
      <Balances
        tags={initialTags}
        accountType={accountType}
        initialBalances={initialBalances}
        linkId={linkId}
        linkToken={linkToken}
        selectedEntityId={entityId}
        selectedTag={entityTag}
        user={user}
        entities={entities}
        uiColor={uiColor}
      />
      {initialMovements.movements.length > 0 && (
        <div className="flex flex-col">
          <h1 className="text-3xl font-semibold tracking-tighter">
            Movimientos
          </h1>
          <MovementsTable
            entities={entities}
            linkId={linkId}
            linkToken={linkToken}
            tags={initialTags}
            accountType={accountType}
            user={user}
            pageSize={pageSize}
            initialMovements={initialMovements}
            entityTag={entityTag}
            entityId={entityId}
          />
        </div>
      )}
    </div>
  );
};

export default AccountsTable;
