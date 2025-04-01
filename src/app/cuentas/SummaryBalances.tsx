"use client";

import { useEffect, useState, type FC } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import { Skeleton } from "~/app/components/ui/skeleton";
import { numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

interface SummaryBalancesProps {
  selectedEntityId: number | undefined;
  selectedTag: string | undefined;
  initialCashBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  initialCurrentAccountBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  linkId: number | null;
  linkToken: string | null;
}

const SummaryBalances: FC<SummaryBalancesProps> = ({
  initialCashBalances,
  initialCurrentAccountBalances,
  linkId,
  selectedEntityId,
  selectedTag,
  linkToken,
}) => {
  const { dayInPast } = useCuentasStore();
  const { data: cashBalances, isFetching: isCashBalancesFetching } =
    api.movements.getBalancesByEntities.useQuery(
      {
        linkId,
        account: true,
        entityId: selectedEntityId,
        dayInPast,
        entityTag: selectedTag,
        linkToken,
        balanceType: selectedEntityId ? "2" : "4",
      },
      { initialData: initialCashBalances, refetchOnWindowFocus: false },
    );

  const {
    data: currentAccountBalances,
    isFetching: isCurrentAccountBalancesFetching,
  } = api.movements.getBalancesByEntities.useQuery(
    {
      linkId,
      account: false,
      entityId: selectedEntityId,
      dayInPast,
      entityTag: selectedTag,
      linkToken,
      balanceType: selectedEntityId ? "2" : "4",
    },
    { initialData: initialCurrentAccountBalances, refetchOnWindowFocus: false },
  );

  const [isFetching, setIsFetching] = useState(false);
  useEffect(() => {
    setIsFetching(isCashBalancesFetching || isCurrentAccountBalancesFetching);
  }, [isCashBalancesFetching, isCurrentAccountBalancesFetching]);

  const balances = [...cashBalances, ...currentAccountBalances];

  // Group balances by currency
  const balancesByCurrency = balances.reduce(
    (acc, balance) => {
      if (!acc[balance.currency]) {
        acc[balance.currency] = {
          caja: 0,
          cuentaCorriente: 0,
        };
      }

      if (balance.account) {
        acc[balance.currency]!.caja += balance.amount;
      } else {
        acc[balance.currency]!.cuentaCorriente += balance.amount;
      }

      return acc;
    },
    {} as Record<string, { caja: number; cuentaCorriente: number }>,
  );

  if (isFetching) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {Object.entries(balancesByCurrency).map(
        ([currency, { caja, cuentaCorriente }]) => (
          <Card key={currency}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {currency.toUpperCase()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caja</span>
                <span
                  className={cn(
                    caja > 0 ? "text-green" : caja < 0 && "text-red",
                  )}
                >
                  {numberFormatter(caja)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cuenta Corriente</span>
                <span
                  className={cn(
                    cuentaCorriente > 0
                      ? "text-green"
                      : cuentaCorriente < 0 && "text-red",
                  )}
                >
                  {numberFormatter(cuentaCorriente)}
                </span>
              </div>
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
};

export default SummaryBalances;
