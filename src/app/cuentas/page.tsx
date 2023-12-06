import { getAllChildrenTags } from "~/lib/functions";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";
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

  const userPermissions = await api.users.getAllPermissions.query({});

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

  const entities = await api.entities.getAll.query();
  const initialTags = await api.tags.getAll.query();

  const filteredTags = initialTags.filter((tag) => {
    if (
      userPermissions?.find(
        (p) => p.name === "ADMIN" || p.name === "ACCOUNTS_VISUALIZE",
      )
    ) {
      return true;
    } else if (
      userPermissions?.find(
        (p) =>
          p.name === "ACCOUNTS_VISUALIZE_SOME" &&
          getAllChildrenTags(p.entitiesTags, initialTags).includes(tag.name),
      )
    ) {
      return true;
    }
  });

  const filteredEntities = entities.filter((entity) => {
    if (
      userPermissions?.find(
        (p) => p.name === "ADMIN" || p.name === "ACCOUNTS_VISUALIZE",
      )
    ) {
      return true;
    } else if (
      userPermissions?.find(
        (p) =>
          p.name === "ACCOUNTS_VISUALIZE_SOME" &&
          (p.entitiesIds?.includes(entity.id) ||
            getAllChildrenTags(p.entitiesTags, initialTags).includes(
              entity.tag.name,
            )),
      )
    ) {
      return true;
    }
  });

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

  let initialMovements: RouterOutputs["movements"]["getMovementsByCurrency"] =
    [];

  if (session?.user) {
    initialMovements = await api.movements.getMovementsByCurrency.query(
      queryInput,
    );
  }

  return (
    <div>
      {(session ? true : initialBalances.length > 0) ? (
        <>
          <div className="flex w-full flex-row justify-between space-x-4 border-b border-muted pb-4">
            {session && (
              <div className="flex flex-row space-x-4">
                <EntitySwitcher
                  entities={filteredEntities}
                  tags={filteredTags}
                />
                {(selectedEntityId || selectedTag) && <TabSwitcher />}
              </div>
            )}
            <TimeRangeSelector />
          </div>
          {selectedEntityId || selectedTag ? (
            <div className="mt-4 w-full">
              {selectedTab === "cuenta_corriente" && (
                <AccountsTab
                  accountType={false}
                  searchParams={searchParams}
                  initialBalances={initialBalances}
                  initialTags={initialTags}
                />
              )}
              {selectedTab === "caja" && (
                <AccountsTab
                  accountType={true}
                  searchParams={searchParams}
                  initialBalances={initialBalances}
                  initialTags={initialTags}
                />
              )}
              {selectedTab === "resumen" && (
                <div>
                  {initialBalances.length > 0 ? (
                    <SummarizedBalances
                      initialTags={initialTags}
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
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">
              Elegí una entidad o un tag
            </h1>
          )}
        </>
      ) : (
        <p className="text-3xl font-semibold">
          El usuario no tiene los permisos suficientes
        </p>
      )}
    </div>
  );
};

export default Page;
