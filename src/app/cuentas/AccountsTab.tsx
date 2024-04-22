import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterOutputs } from "~/trpc/shared";
import dynamic from "next/dynamic";
const MovementsTable = dynamic(
  () => import("./MovementsTable"), { ssr: false });
const Balances = dynamic(() => import("./Balances"), { ssr: false })


const AccountsTable = async ({
  initialBalances,
  accountType,
  initialTags,
  linkId,
  linkToken,
  selectedEntity,
  entityTag,
  dayInPast,
  uiColor,
  mainTags
}: {
  searchParams: Record<string, string | string[] | undefined>;
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  accountType: boolean;
  initialTags: RouterOutputs["tags"]["getAll"];
  linkId: number | null;
  selectedEntity: RouterOutputs["entities"]["getAll"][number] | undefined
  linkToken: string | null;
  entityTag: string | undefined;
  dayInPast: string | null;
  uiColor: string | undefined
  mainTags: string[]
}) => {
  const user = await getUser();

  const entities = await api.entities.getAll.query();

  const pageSize = 20;

  const initialMovements = await api.movements.getCurrentAccounts.query({
    linkId: linkId,
    linkToken: linkToken,
    sharedEntityId: selectedEntity?.id,
    pageSize: pageSize,
    pageNumber: 1,
    entityId: selectedEntity?.id,
    entityTag: entityTag,
    account: accountType,
    dayInPast: dayInPast ?? undefined,
  });

  return (
    <div className="flex flex-grow flex-col space-y-8">
      <div suppressHydrationWarning={true}>
        {initialBalances && (
          <Balances
            mainTags={mainTags}
            dayInPast={dayInPast ?? undefined}
            tags={initialTags}
            accountType={accountType}
            initialBalances={initialBalances}
            linkId={linkId}
            linkToken={linkToken}
            selectedEntity={selectedEntity}
            selectedTag={entityTag}
            user={user}
            entities={entities}
            uiColor={uiColor}
          />
        )}
      </div>
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
            entityId={selectedEntity?.id}
          />
        </div>
      )}
    </div>
  );
};

export default AccountsTable;
