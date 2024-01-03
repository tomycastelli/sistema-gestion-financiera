import { Suspense } from "react";
import { getAllChildrenTags } from "~/lib/functions";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";
import LoadingAnimation from "../components/LoadingAnimation";
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
    account:
      selectedTab === "cuenta_corriente"
        ? false
        : selectedTab === "caja"
        ? true
        : undefined,
    linkToken: linkToken,
    linkId: linkId,
  };
  const initialBalances = await api.movements.getBalancesByEntities.query(
    initialBalancesInput,
  );

  const initialBalancesForCard =
    await api.movements.getBalancesByEntitiesForCard.query({
      entityId: initialBalancesInput.entityId,
      entityTag: initialBalancesInput.entityTag,
      linkId: initialBalancesInput.linkId,
      linkToken: initialBalancesInput.linkToken,
    });

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
      {initialBalances ? (
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
          <Suspense fallback={<LoadingAnimation text={"Cargando cuentas"} />}>
            {selectedEntityId || selectedTag ? (
              <div className="mt-4 w-full">
                {(selectedTab === "cuenta_corriente" ||
                  selectedTab === "caja") && (
                  <AccountsTab
                    entityId={selectedEntityId}
                    entityTag={selectedTag}
                    accountType={selectedTab === "caja" ? true : false}
                    searchParams={searchParams}
                    initialBalances={initialBalances}
                    initialTags={initialTags}
                    linkId={linkId}
                    linkToken={linkToken}
                  />
                )}
                {selectedTab === "resumen" && (
                  <div>
                    <SummarizedBalances
                      tags={initialTags}
                      initialMovements={initialMovements}
                      movementsAmount={movementsAmount}
                      selectedTag={selectedTag}
                      selectedEntityId={selectedEntityId}
                      initialBalancesForCard={initialBalancesForCard}
                      initialBalancesForCardInput={{
                        linkId: initialBalancesInput.linkId,
                        linkToken: initialBalancesInput.linkToken,
                        entityId: initialBalancesInput.entityId,
                        entityTag: initialBalancesInput.entityTag,
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight">
                Elegí una entidad o un tag
              </h1>
            )}
          </Suspense>
        </>
      ) : session?.user ? (
        <p className="text-3xl font-semibold">No se encontraron balances</p>
      ) : (
        <p className="text-3xl font-semibold">
          El usuario no tiene los permisos suficientes
        </p>
      )}
    </div>
  );
};

export default Page;
