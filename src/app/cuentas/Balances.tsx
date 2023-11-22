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
  accountType: boolean;
}

const Balances: FC<BalancesProps> = ({ initialBalances, accountType }) => {
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

  return (
    <div className="grid-cols grid grid-flow-col space-y-4">
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
                          {new Intl.NumberFormat("es-AR").format(totals.amount)}
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
  );
};

export default Balances;
