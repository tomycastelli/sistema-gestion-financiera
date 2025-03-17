"use client";

import { type User } from "lucia";
import { type FC, useEffect } from "react";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import CashBalancesTable from "./CashBalancesTable";
import CurrentAccountsBalancesTable from "./CurrentAccountsBalancesTable";

interface BalancesProps {
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  accountType: boolean;
  linkId: number | null;
  linkToken: string | null;
  selectedEntity: RouterOutputs["entities"]["getAll"][number] | undefined;
  selectedTag: string | undefined;
  tags: RouterOutputs["tags"]["getAll"];
  user: User | null;
  entities: RouterOutputs["entities"]["getAll"];
  uiColor: string | undefined;
  mainTags: string[];
  initialLatestExchangeRates: RouterOutputs["exchangeRates"]["getLatestExchangeRates"];
  main_name: string;
}

const Balances: FC<BalancesProps> = ({
  initialBalances,
  selectedEntity,
  selectedTag,
  user,
  entities,
  uiColor,
  linkId,
  linkToken,
  accountType,
  mainTags,
  initialLatestExchangeRates,
  main_name,
}) => {
  const { isInverted, setIsInverted, dayInPast } = useCuentasStore();

  useEffect(() => {
    if (selectedTag) {
      if (mainTags.includes(selectedTag)) {
        setIsInverted(false);
      } else {
        setIsInverted(true);
      }
    } else if (selectedEntity) {
      if (mainTags.includes(selectedEntity.tag.name)) {
        setIsInverted(false);
      } else {
        setIsInverted(true);
      }
    }
  }, [mainTags, selectedEntity, selectedTag, setIsInverted]);

  const { data: balances, isFetching } =
    api.movements.getBalancesByEntities.useQuery(
      {
        linkId,
        account: accountType,
        entityId: selectedEntity?.id,
        dayInPast,
        entityTag: selectedTag,
        linkToken,
      },
      { initialData: initialBalances, refetchOnWindowFocus: false },
    );

  const { data: latestExchangeRates } =
    api.exchangeRates.getLatestExchangeRates.useQuery(
      { dayInPast },
      { initialData: initialLatestExchangeRates },
    );

  return (
    <div className="flex flex-col space-y-4">
      {accountType ? (
        <CashBalancesTable
          balances={balances}
          selectedEntityId={selectedEntity?.id}
          selectedTag={selectedTag}
          isInverted={isInverted}
          isFetching={isFetching}
          uiColor={uiColor}
          latestExchangeRates={latestExchangeRates}
          user={user}
          main_name={main_name}
        />
      ) : (
        <CurrentAccountsBalancesTable
          isFetching={isFetching}
          entities={entities}
          uiColor={uiColor}
          user={user}
          balances={balances}
          selectedEntity={selectedEntity}
          selectedTag={selectedTag}
          initialLatestExchangeRates={initialLatestExchangeRates}
        />
      )}
    </div>
  );
};

export default Balances;
