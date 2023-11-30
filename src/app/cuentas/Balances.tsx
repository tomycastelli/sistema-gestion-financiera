"use client";

import { useSearchParams } from "next/navigation";
import { type FC } from "react";
import { calculateTotal, capitalizeFirstLetter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

interface BalancesProps {
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  initialDetailedBalances: RouterOutputs["movements"]["getDetailedBalance"];
  accountType: boolean;
}

const Balances: FC<BalancesProps> = ({
  initialBalances,
  accountType,
  initialDetailedBalances,
}) => {
  const searchParams = useSearchParams();

  const selectedTag = searchParams.get("tag");
  const selectedEntityIdString = searchParams.get("entidad");
  const linkIdString = searchParams.get("id");
  const linkId = linkIdString ? parseInt(linkIdString) : null;

  const linkToken = searchParams.get("token");

  const selectedEntityId = selectedEntityIdString
    ? parseInt(selectedEntityIdString)
    : null;

  const { data: balances, isLoading: isBalanceLoading } =
    api.movements.getBalancesByEntities.useQuery(
      {
        entityId: selectedEntityId,
        entityTag: selectedTag,
        linkId: linkId,
        linkToken: linkToken,
      },
      { initialData: initialBalances, refetchOnWindowFocus: false },
    );

  const { selectedTimeframe } = useCuentasStore();

  const balancesSummary = calculateTotal(balances, selectedTimeframe);

  const { data: detailedBalances, isLoading: isDetailedLoading } =
    api.movements.getDetailedBalance.useQuery(
      {
        entityId: selectedEntityId,
        entityTag: selectedTag,
        linkId: linkId,
        linkToken: linkToken,
      },
      { initialData: initialDetailedBalances, refetchOnWindowFocus: false },
    );

  type GroupedBalanceResult = {
    entityid: number;
    entitytag: string;
    entityname: string;
    balances: { currency: string; balance: number }[];
  };

  const groupedDetailedBalances: GroupedBalanceResult[] = Object.values(
    detailedBalances.reduce(
      (grouped, balance) => {
        const entityid = balance.entityid;

        if (!grouped[entityid]) {
          grouped[entityid] = {
            entityid,
            entitytag: balance.entitytag,
            entityname: balance.entityname,
            balances: [],
          };
        }

        grouped[entityid]!.balances.push({
          currency: balance.currency,
          balance: balance.balance,
        });

        return grouped;
      },
      {} as Record<number, GroupedBalanceResult>,
    ),
  );

  const currencyOrder = ["USD", "ARS", "USDT", "EUR", "BRL"];

  return (
    <div className="flex flex-col space-y-8">
      <div className="grid-cols grid grid-flow-col gap-4">
        {!isBalanceLoading ? (
          balancesSummary.map((entity) => (
            <Card key={entity.entityId} className="min-w-[300px]">
              <CardHeader>
                <CardTitle>{entity.entityName}</CardTitle>
                <CardDescription>
                  {capitalizeFirstLetter(entity.entityTag)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-2">
                  <p className="flex justify-end font-semibold">
                    {selectedTimeframe === "daily"
                      ? "Diario"
                      : selectedTimeframe === "monthly"
                      ? "Mensual"
                      : selectedTimeframe === "weekly"
                      ? "Semanal"
                      : ""}
                  </p>
                  {entity.totalBalances
                    .filter((totals) => totals.status === accountType)
                    .map((totals) => (
                      <div key={totals.currency} className="grid grid-cols-4">
                        <p className="col-span-1">
                          {totals.currency.toUpperCase()}
                        </p>
                        <div className="col-span-3 flex flex-row justify-between space-x-6">
                          <p className="text-xl font-bold">
                            ${" "}
                            {new Intl.NumberFormat("es-AR").format(
                              totals.amount,
                            )}
                          </p>
                          <p
                            className={cn(
                              "text-lg font-semibold",
                              totals.amount - totals.beforeAmount > 0
                                ? "text-green"
                                : totals.amount - totals.beforeAmount < 0
                                ? "text-red"
                                : "text-slate-300",
                            )}
                          >
                            {new Intl.NumberFormat("es-AR").format(
                              totals.amount - totals.beforeAmount,
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p>Cargando...</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        <div className="grid grid-cols-6 rounded-xl border border-muted-foreground p-3">
          <p>Entidad</p>
          {currencyOrder.map((currency) => (
            <p key={currency}>{currency}</p>
          ))}
        </div>
        {!isDetailedLoading ? (
          groupedDetailedBalances.map((item) => (
            <div
              key={item.entityid}
              className="grid grid-cols-6 rounded-xl p-3 font-semibold"
            >
              <p>{item.entityname}</p>
              {item.balances
                .sort(
                  (a, b) =>
                    currencyOrder.indexOf(a.currency) -
                    currencyOrder.indexOf(b.currency),
                )
                .map((balance) => (
                  <p key={balance.currency}>{balance.balance}</p>
                ))}
            </div>
          ))
        ) : (
          <p>Cargando...</p>
        )}
      </div>
    </div>
  );
};

export default Balances;
