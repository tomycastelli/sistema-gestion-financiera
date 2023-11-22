import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterInputs } from "~/trpc/shared";
import AccountsTab from "./AccountsTab";
import EntitySwitcher from "./EntitySwitcher";
import SummarizedBalances from "./SummarizedBalances";
import TabSwitcher from "./TabSwitcher";
import TimeRangeSelector from "./TimeRangeSelector";

const Page = async ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) => {
  const session = await getServerAuthSession();

  const selectedTag = searchParams.tag as string | null;
  const selectedEntityIdString = searchParams.entidad as string | null;
  const linkToken = searchParams.token as string | null;
  const selectedTab = searchParams.cuenta
    ? (searchParams.cuenta as string)
    : "resumen";

  const linkIdString = searchParams.id as string | null;
  const linkId = linkIdString ? parseInt(linkIdString) : null;

  const selectedEntityId = selectedEntityIdString
    ? parseInt(selectedEntityIdString)
    : null;

  let initialEntities = [
    {
      id: 0,
      name: "",
      tag: "",
    },
  ];
  if (session) {
    initialEntities = await api.entities.getAll.query();
  }

  const initialBalancesInput = {
    entityTag: selectedTag,
    entityId: selectedEntityId,
    linkToken: linkToken,
    linkId: linkId,
  };
  const initialBalances = await api.movements.getBalancesByEntities.query(
    initialBalancesInput,
  );

  const movementsAmount = 5;

  const queryInput: RouterInputs["movements"]["getMovementsByCurrency"] = {
    limit: movementsAmount,
    currency: "ars",
  };

  if (selectedTag) {
    queryInput.entityTag = selectedTag;
  } else if (selectedEntityId) {
    queryInput.entityId = selectedEntityId;
  }

  const initialMovements = await api.movements.getMovementsByCurrency.query(
    queryInput,
  );

  return (
    <div>
      <div className="flex w-full flex-row justify-between space-x-4 border-b border-muted pb-4">
        {session && (
          <div className="flex flex-row space-x-4">
            <EntitySwitcher initialEntities={initialEntities} />
            <TabSwitcher />
          </div>
        )}
        <TimeRangeSelector />
      </div>
      <div className="mt-4 w-full">
        {selectedTab === "cuenta_corriente" && (
          <AccountsTab
            accountType={false}
            searchParams={searchParams}
            initialBalances={initialBalances}
          />
        )}
        {selectedTab === "caja" && (
          <AccountsTab
            accountType={true}
            searchParams={searchParams}
            initialBalances={initialBalances}
          />
        )}
        {selectedTab === "resumen" && (
          <div>
            {initialBalances.length > 0 ? (
              <SummarizedBalances
                initialBalances={initialBalances}
                initialMovements={initialMovements}
                movementsAmount={movementsAmount}
                selectedTag={selectedTag}
                selectedEntityId={selectedEntityId}
                initialBalancesInput={initialBalancesInput}
              />
            ) : (
              <p>No hay balances</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;
