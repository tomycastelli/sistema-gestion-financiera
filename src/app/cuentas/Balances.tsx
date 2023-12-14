"use client";

import Lottie from "lottie-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type FC } from "react";
import useSearch from "~/hooks/useSearch";
import {
  calculateTotal,
  capitalizeFirstLetter,
  createQueryString,
} from "~/lib/functions";
import { cn } from "~/lib/utils";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

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
  const [detailedBalancesPage, setDetailedBalancesPage] = useState<number>(1);
  const pageSize = 10;

  const [filteredEntity, setFilteredEntity] = useState<string>();

  const searchParams = useSearchParams();

  const pathname = usePathname();

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
        accountType: accountType,
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

  const {
    results: filteredDetailedBalances,
    searchValue: searchDetailedBalanceValue,
    setSearchValue: setSearchDetailedBalanceValue,
  } = useSearch<(typeof groupedDetailedBalances)[0]>({
    dataSet: groupedDetailedBalances,
    keys: ["entityname"],
  });

  const balanceArrayToRender = filteredEntity
    ? groupedDetailedBalances.filter(
        (item) => item.entityname === filteredEntity,
      )
    : filteredDetailedBalances.slice(
        (detailedBalancesPage - 1) * pageSize,
        detailedBalancesPage * pageSize,
      );

  const currencyOrder = ["usd", "ars", "usdt", "eur", "brl"];

  return (
    <div className="flex flex-col space-y-4">
      <h1 className="text-3xl font-semibold tracking-tighter">Entidades</h1>
      <div className="grid-cols grid grid-cols-4 gap-4">
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
          <Lottie animationData={loadingJson} className="h-24" loop={true} />
        )}
      </div>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-4">
          <h1 className="text-3xl font-semibold tracking-tighter">Cuentas</h1>
          <Input
            value={searchDetailedBalanceValue}
            onChange={(e) => setSearchDetailedBalanceValue(e.target.value)}
            placeholder="Buscar"
            className="w-32"
          />
          <Select
            onValueChange={(value) =>
              value === "todos"
                ? setFilteredEntity(undefined)
                : setFilteredEntity(value)
            }
            defaultValue={filteredEntity}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Elegir" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="todos">Todos</SelectItem>
                {groupedDetailedBalances.map((balance) => (
                  <SelectItem key={balance.entityid} value={balance.entityname}>
                    {balance.entityname}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-row items-center justify-end space-x-2">
          {detailedBalancesPage > 1 && (
            <Button
              variant="outline"
              className="p-1"
              onClick={() => setDetailedBalancesPage(detailedBalancesPage - 1)}
            >
              <Icons.chevronLeft className="h-5" />
            </Button>
          )}

          <p className="text-lg">{detailedBalancesPage}</p>
          {Math.round(filteredDetailedBalances.length / pageSize) >=
            detailedBalancesPage && (
            <Button
              variant="outline"
              className="p-1"
              onClick={() => setDetailedBalancesPage(detailedBalancesPage + 1)}
            >
              <Icons.chevronRight className="h-5" />
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="grid grid-cols-6 justify-items-center rounded-xl border border-muted-foreground p-2">
          <p>Entidad</p>
          {currencyOrder.map((currency) => (
            <p key={currency}>{currency.toUpperCase()}</p>
          ))}
        </div>
        {!isDetailedLoading ? (
          balanceArrayToRender.length > 0 ? (
            balanceArrayToRender.map((item, index) => (
              <div
                key={item.entityid}
                className={cn(
                  "grid grid-cols-6 justify-items-center rounded-xl font-semibold",
                  index % 2 === 0 ? "bg-muted p-3" : "bg-white",
                )}
              >
                <p className="p-2">{item.entityname}</p>
                {currencyOrder.map((currency) => {
                  const matchingBalance = item.balances.find(
                    (balance) => balance.currency === currency,
                  );

                  return matchingBalance ? (
                    <Link
                      href={
                        pathname +
                        "?" +
                        createQueryString(
                          new URLSearchParams(
                            createQueryString(
                              searchParams,
                              "entidad_destino",
                              item.entityid.toString(),
                            ),
                          ),
                          "divisa",
                          currency,
                        )
                      }
                      key={currency}
                      className="rounded-full p-2 transition-all hover:scale-105 hover:cursor-default hover:bg-primary hover:text-white hover:shadow-md"
                    >
                      {new Intl.NumberFormat("es-AR").format(
                        matchingBalance.balance,
                      )}
                    </Link>
                  ) : (
                    <p></p>
                  );
                })}
              </div>
            ))
          ) : (
            <p>No hay movimientos</p>
          )
        ) : (
          <Lottie animationData={loadingJson} className="h-24" loop={true} />
        )}
      </div>
    </div>
  );
};

export default Balances;
