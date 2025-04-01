import dynamic from "next/dynamic";
import { Suspense } from "react";
import { getAccountingPeriodDate, getAllChildrenTags } from "~/lib/functions";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterInputs } from "~/trpc/shared";
import AccountsTab from "./AccountsTab";
import CurrentAccountsTotalsSwitch from "./CurrentAccountsTotalsSwitch";
import EntitySwitcher from "./EntitySwitcher";
import SummaryBalances from "./SummaryBalances";
import TabSwitcher from "./TabSwitcher";
import TimeMachine from "./TimeMachine";
const LoadingAnimation = dynamic(
  () => import("../components/LoadingAnimation"),
);

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

  const users = await api.users.getAll.query();

  const filteredTags = await api.tags.getFiltered.query();

  const { data: mainTagData } = await api.globalSettings.get.query({
    name: "mainTag",
  });

  const mainTag = mainTagData as { tag: string };

  const mainTags = getAllChildrenTags(mainTag.tag, filteredTags);

  const selectedEntityObj = selectedEntityId
    ? initialEntities.find((e) => e.id === parseInt(selectedEntityId))
    : undefined;
  const selectedTagObj = selectedTag
    ? filteredTags.find((t) => t.name === selectedTag)
    : undefined;

  const balanceType =
    selectedTab === "resumen"
      ? selectedEntityObj?.id
        ? "2"
        : "4"
      : selectedTab === "caja"
      ? selectedEntityObj?.id
        ? "2"
        : "4"
      : selectedTagObj?.name
      ? "3"
      : "1";

  const initialBalancesInput: RouterInputs["movements"]["getBalancesByEntities"] =
    {
      entityTag: selectedTagObj?.name,
      entityId: selectedEntityObj?.id,
      account: selectedTab === "caja",
      balanceType,
      linkToken: linkToken,
      linkId: linkId,
      dayInPast: undefined,
    };
  const initialBalances = await api.movements.getBalancesByEntities.query(
    initialBalancesInput,
  );
  const initialOtherBalances = await api.movements.getBalancesByEntities.query({
    ...initialBalancesInput,
    account: selectedTab !== "caja",
  });

  const uiColor = selectedEntityObj
    ? selectedEntityObj.tag.color ?? undefined
    : selectedTagObj
    ? selectedTagObj.color ?? undefined
    : undefined;

  const { data: accountingPeriodData } = await api.globalSettings.get.query({
    name: "accountingPeriod",
  });

  const accountingPeriod = accountingPeriodData as {
    months: number;
    graceDays: number;
  };

  const accountingPeriodDate = getAccountingPeriodDate(
    accountingPeriod.months,
    accountingPeriod.graceDays,
  );

  return mainTags.includes(selectedTag ?? "") ||
    mainTags.includes(selectedEntityObj?.tag.name ?? "") ? (
    <div>
      <div
        className="flex w-full flex-row justify-between space-x-8 border-b-2 pb-4"
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
            {(selectedEntityObj?.id || selectedTagObj?.name) && (
              <TabSwitcher
                uiColor={uiColor}
                selectedEntityId={selectedEntityObj?.id.toString()}
                selectedTag={selectedTagObj?.name}
              />
            )}
          </div>
        )}
        {(selectedEntityObj?.id || selectedTagObj?.name) && (
          <div className="flex flex-wrap gap-4">
            {selectedTab === "cuenta_corriente" && (
              <CurrentAccountsTotalsSwitch />
            )}
            <TimeMachine />
          </div>
        )}
      </div>
      <Suspense fallback={<LoadingAnimation text={"Cargando cuentas"} />}>
        {initialBalances ? (
          selectedEntityObj?.id || selectedTagObj?.name ? (
            <div className="mt-4 w-full">
              {selectedTab === "resumen" && (
                <SummaryBalances
                  initialCashBalances={initialOtherBalances}
                  initialCurrentAccountBalances={initialBalances}
                  linkId={linkId}
                  selectedEntityId={selectedEntityObj?.id}
                  selectedTag={selectedTagObj?.name}
                  linkToken={linkToken}
                />
              )}
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
                />
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
  ) : (
    <p>La entidad seleccionada no pertenece al tag: {mainTags.join(", ")}</p>
  );
};

export default Page;
