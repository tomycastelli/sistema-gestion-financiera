import dynamic from "next/dynamic";
import { Suspense } from "react";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterInputs } from "~/trpc/shared";
import EntitySwitcher from "./EntitySwitcher";
import TabSwitcher from "./TabSwitcher";
import AccountsTab from "./AccountsTab";
import TimeMachine from "./TimeMachine";
import { getAccountingPeriodDate, getAllChildrenTags } from "~/lib/functions";
const LoadingAnimation = dynamic(
  () => import("../components/LoadingAnimation"),
);
const SummarizedBalances = dynamic(() => import("./SummarizedBalances"), { ssr: false })

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
  const dayInPast = searchParams.dia as string | null

  const initialEntities = await api.entities.getFiltered.query({
    permissionName: "ACCOUNTS_VISUALIZE",
  });

  const users = await api.users.getAll.query()

  const filteredTags = await api.tags.getFiltered.query();

  const { data: mainTagData } = await api.globalSettings.get.query({ name: "mainTag" })

  const mainTag = mainTagData as { tag: string }

  const mainTags = getAllChildrenTags(mainTag.tag, filteredTags)

  const selectedEntityObj = selectedEntityId ? initialEntities.find(e => e.id === parseInt(selectedEntityId)) : undefined
  const selectedTagObj = selectedTag ? filteredTags.find(t => t.name === selectedTag) : undefined

  const initialBalancesInput: RouterInputs["movements"]["getBalancesByEntities"] = {
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
    dayInPast: dayInPast ?? undefined
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
      dayInPast: dayInPast ?? undefined
    });

  const movementsAmount = 5;

  const queryInput: RouterInputs["movements"]["getCurrentAccounts"] = {
    pageSize: movementsAmount,
    currency: "ars",
    pageNumber: 1,
    entityTag: selectedTag,
    entityId: selectedEntityObj?.id,
    dayInPast: dayInPast ?? undefined
  };

  const initialMovements = await api.movements.getCurrentAccounts.query(
    queryInput,
  );

  const uiColor = selectedEntityObj ? selectedEntityObj.tag.color ?? undefined : selectedTagObj ? selectedTagObj.color ?? undefined : undefined

  const { data: accountingPeriodData } = await api.globalSettings.get.query({ name: "accountingPeriod" })

  const accountingPeriod = accountingPeriodData as { months: number; graceDays: number; }

  const accountingPeriodDate = getAccountingPeriodDate(accountingPeriod.months, accountingPeriod.graceDays)

  return (
    <div>
      <div className="flex w-full flex-row justify-between space-x-8 border-b-2 pb-4"
        style={{ borderColor: uiColor }}
      >
        {user && (
          <div className="flex flex-wrap gap-4">
            <EntitySwitcher
              mainTags={mainTags}
              uiColor={uiColor}
              selectedEntityObj={selectedEntityObj}
              selectedTagObj={selectedTagObj}
              entities={initialEntities}
              tags={filteredTags}
            />
            {(selectedEntityObj?.id || selectedTagObj?.name) && <TabSwitcher uiColor={uiColor} selectedEntityId={selectedEntityObj?.id.toString()} selectedTag={selectedTagObj?.name} />}
          </div>
        )}
        {(selectedEntityObj?.id || selectedTagObj?.name) && (
          <div className="flex flex-wrap gap-4">
            <TimeMachine />
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
                    users={users}
                    accountingPeriodDate={accountingPeriodDate}
                    mainTags={mainTags}
                    uiColor={uiColor}
                    selectedEntity={selectedEntityObj}
                    entityTag={selectedTagObj?.name}
                    accountType={selectedTab === "caja" ? true : false}
                    searchParams={searchParams}
                    initialBalances={initialBalances}
                    initialTags={filteredTags}
                    linkId={linkId}
                    linkToken={linkToken}
                    dayInPast={dayInPast}
                  />
                )}
              {selectedTab === "resumen" && (
                <div suppressHydrationWarning={true}>
                  {initialBalancesForCard && (
                    <SummarizedBalances
                      mainTags={mainTags}
                      initialBalancesInput={{
                        linkToken: linkToken,
                        linkId: linkId,
                        entityId: selectedEntityObj?.id,
                        entityTag: selectedTagObj?.name,
                        dayInPast: dayInPast ?? undefined
                      }}
                      uiColor={uiColor}
                      tags={filteredTags}
                      initialMovements={initialMovements}
                      selectedTag={selectedTagObj?.name}
                      selectedEntity={selectedEntityObj}
                      initialBalancesForCard={initialBalancesForCard}
                      dayInPast={dayInPast ?? undefined}
                    />
                  )}
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
