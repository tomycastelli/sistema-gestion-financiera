import dynamic from "next/dynamic";
import { Suspense } from "react";
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

  const selectedTag = searchParams.tag as string | null;
  const selectedEntityId = searchParams.entidad as string | null;
  const linkToken = searchParams.token as string | null;
  const selectedTab = searchParams.cuenta
    ? (searchParams.cuenta as string)
    : "resumen";

  const linkIdString = searchParams.id as string | null;
  const linkId = linkIdString ? parseInt(linkIdString) : null;

  const initialEntities = await api.entities.getFiltered.query({
    permissionName: "ACCOUNTS_VISUALIZE",
  });
  const filteredTags = await api.tags.getFiltered.query();

  const selectedEntityObj = selectedEntityId ? initialEntities.find(e => e.id === parseInt(selectedEntityId)) : undefined
  const selectedTagObj = selectedTag ? filteredTags.find(t => t.name === selectedTag) : undefined

  const initialBalancesInput = {
    entityTag: selectedTagObj?.name,
    entityId: selectedEntityObj?.id,
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
    entityId: selectedEntityObj?.id,
  };

  const initialMovements = await api.movements.getCurrentAccounts.query(
    queryInput,
  );

  const uiColor = selectedEntityObj ? selectedEntityObj.tag.color ?? undefined : selectedTagObj ? selectedTagObj.color ?? undefined : undefined

  return (
    <div>
      <div className="flex w-full flex-row justify-between space-x-8 border-b-2 pb-4"
        style={{ borderColor: uiColor }}
      >
        {user && (
          <div className="flex flex-wrap gap-4">
            <EntitySwitcher
              uiColor={uiColor}
              selectedEntityObj={selectedEntityObj}
              selectedTagObj={selectedTagObj}
              entities={initialEntities}
              tags={filteredTags}
            />
            {(selectedEntityObj?.id || selectedTagObj?.name) && <TabSwitcher uiColor={uiColor} selectedEntityId={selectedEntityObj?.id.toString()} selectedTag={selectedTagObj?.name} />}
            {(selectedEntityObj?.id || selectedTagObj?.name) && <InvertSwitch uiColor={uiColor} entities={initialEntities} />}
          </div>
        )}
        {(selectedEntityObj?.id || selectedTagObj?.name) && (
          <div className="flex flex-wrap gap-4">
            <TimeMachine />
            <TimeRangeSelector />
          </div>
        )}
      </div>
      <Suspense fallback={<LoadingAnimation text={"Cargando cuentas"} />}>
        {initialBalances ? (
          selectedEntityObj?.id || selectedTagObj?.name ? (
            <div className="mt-4 w-full">
              {(selectedTab === "cuenta_corriente" ||
                selectedTab === "caja") && (
                  <AccountsTab
                    uiColor={uiColor}
                    entityId={selectedEntityObj?.id}
                    entityTag={selectedTagObj?.name}
                    accountType={selectedTab === "caja" ? true : false}
                    searchParams={searchParams}
                    initialBalances={initialBalances}
                    initialTags={filteredTags}
                    linkId={linkId}
                    linkToken={linkToken}
                  />
                )}
              {selectedTab === "resumen" && (
                <div>
                  <SummarizedBalances
                    tags={filteredTags}
                    initialMovements={initialMovements}
                    selectedTag={selectedTagObj?.name}
                    selectedEntityId={selectedEntityObj?.id}
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
          )
        ) : user ? (
          <p className="text-3xl font-semibold">No se encontró una cuenta</p>
        ) : (
          <p className="text-3xl font-semibold">
            El usuario no tiene los permisos suficientes
          </p>
        )}
      </Suspense>
    </div>
  );
};

export default Page;
