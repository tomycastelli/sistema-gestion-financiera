import dynamic from "next/dynamic";
import { Suspense } from "react";
import { getAllChildrenTags } from "~/lib/functions";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterInputs } from "~/trpc/shared";
import EntitySwitcher from "./EntitySwitcher";
import InvertSwitch from "./InvertSwitch";
import TabSwitcher from "./TabSwitcher";
import { TimeMachine } from "./TimeMachine";
const LoadingAnimation = dynamic(
  () => import("../components/LoadingAnimation"),
);
const AccountsTab = dynamic(() => import("./AccountsTab"));
const SummarizedBalances = dynamic(() => import("./SummarizedBalances"));
const TimeRangeSelector = dynamic(() => import("./TimeRangeSelector"));

const Page = async ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) => {
  const user = await getUser();

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

  const initialEntities = await api.entities.getFiltered.query({
    permissionName: "ACCOUNTS_VISUALIZE",
  });
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

  const queryInput: RouterInputs["movements"]["getCurrentAccounts"] = {
    pageSize: movementsAmount,
    currency: "ars",
    pageNumber: 1,
    entityTag: selectedTag,
    entityId: selectedEntityId,
  };

  const initialMovements = await api.movements.getCurrentAccounts.query(
    queryInput,
  );

  return (
    <div>
      {initialBalances ? (
        <>
          <div className="flex w-full flex-row justify-between space-x-8 border-b border-muted pb-4">
            {user && (
              <div className="flex flex-wrap gap-4">
                <EntitySwitcher
                  entities={initialEntities}
                  tags={filteredTags}
                />
                {(selectedEntityId || selectedTag) && <TabSwitcher />}
                <InvertSwitch entities={initialEntities} />
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              <TimeMachine />
              <TimeRangeSelector />
            </div>
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
      ) : user ? (
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
