"use client";

import Lottie from "lottie-react";
import Link from "next/link";
import { useState, type FC } from "react";
import { z } from "zod";
import useSearch from "~/hooks/useSearch";
import { capitalizeFirstLetter, getAllChildrenTags } from "~/lib/functions";
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

interface BalancesProps {
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  accountType: boolean;
  linkId: number | null;
  linkToken: string | null;
  selectedEntityId: number | null;
  selectedTag: string | null;
  tags: RouterOutputs["tags"]["getAll"];
}

const Balances: FC<BalancesProps> = ({
  initialBalances,
  accountType,
  linkId,
  linkToken,
  selectedEntityId,
  selectedTag,
  tags,
}) => {
  const [detailedBalancesPage, setDetailedBalancesPage] = useState<number>(1);
  const pageSize = 10;

  const allChildrenTags = getAllChildrenTags(selectedTag, tags);

  const {
    selectedCurrency,
    setSelectedCurrency,
    setDestinationEntityId,
    destinationEntityId,
  } = useCuentasStore();

  const {
    data: balances,
    isLoading: isBalanceLoading,
    isRefetching,
  } = api.movements.getBalancesByEntities.useQuery(
    {
      entityId: selectedEntityId,
      entityTag: selectedTag,
      account: accountType,
      linkId: linkId,
      linkToken: linkToken,
    },
    { initialData: initialBalances, refetchOnWindowFocus: false },
  );

  const transformedBalancesSchema = z.object({
    entity: z.object({
      id: z.number().int(),
      name: z.string(),
      tagName: z.string(),
    }),
    data: z.array(z.object({ currency: z.string(), balance: z.number() })),
  });

  const transformedBalances: z.infer<typeof transformedBalancesSchema>[] =
    balances!.reduce(
      (acc, balance) => {
        if (selectedEntityId) {
          let entityEntry = acc.find(
            (entry) =>
              entry.entity.id ===
              (balance.selectedEntityId === selectedEntityId
                ? balance.selectedEntityId
                : balance.otherEntityId),
          );

          if (!entityEntry) {
            entityEntry = {
              entity:
                selectedEntityId === balance.selectedEntityId
                  ? balance.selectedEntity
                  : balance.otherEntity,
              data: [],
            };
            acc.push(entityEntry);
          }

          const balanceMultiplier =
            entityEntry.entity.id === balance.selectedEntityId ? 1 : -1;

          let dataEntry = entityEntry.data.find(
            (d) => d.currency === balance.currency,
          );

          if (!dataEntry) {
            dataEntry = {
              currency: balance.currency,
              balance: 0,
            };
            entityEntry.data.push(dataEntry);
          }

          dataEntry.balance += balance.balance * balanceMultiplier;
        } else if (selectedTag) {
          const myPOVEntity = allChildrenTags.includes(
            balance.selectedEntity.tagName,
          )
            ? balance.selectedEntity
            : balance.otherEntity;
          let entityEntry = acc.find(
            (entry) => entry.entity.id === myPOVEntity.id,
          );

          if (!entityEntry) {
            entityEntry = {
              entity: myPOVEntity,
              data: [],
            };
            acc.push(entityEntry);
          }

          const balanceMultiplier =
            entityEntry.entity.id === balance.selectedEntityId ? 1 : -1;

          let dataEntry = entityEntry.data.find(
            (d) => d.currency === balance.currency,
          );

          if (!dataEntry) {
            dataEntry = {
              currency: balance.currency,
              balance: 0,
            };
            entityEntry.data.push(dataEntry);
          }

          dataEntry.balance += balance.balance * balanceMultiplier;
        }

        return acc;
      },
      [] as z.infer<typeof transformedBalancesSchema>[],
    );

  const currencyOrder = ["usd", "ars", "usdt", "eur", "brl"];

  let detailedBalances: z.infer<typeof transformedBalancesSchema>[] = [];

  if (selectedEntityId) {
    detailedBalances = balances!.reduce(
      (acc, balance) => {
        let entityEntry = acc.find(
          (entry) =>
            entry.entity.id ===
            (balance.selectedEntityId === selectedEntityId
              ? balance.otherEntity.id
              : balance.selectedEntity.id),
        );

        if (!entityEntry) {
          entityEntry = {
            entity:
              balance.selectedEntityId === selectedEntityId
                ? balance.otherEntity
                : balance.selectedEntity,
            data: [],
          };
          acc.push(entityEntry);
        }

        const balanceMultiplier =
          entityEntry.entity.id === balance.selectedEntityId ? -1 : 1;

        let dataEntry = entityEntry.data.find(
          (d) => d.currency === balance.currency,
        );

        if (!dataEntry) {
          dataEntry = {
            currency: balance.currency,
            balance: 0,
          };
          entityEntry.data.push(dataEntry);
        }

        dataEntry.balance += balance.balance * balanceMultiplier;

        return acc;
      },
      [] as z.infer<typeof transformedBalancesSchema>[],
    );
  } else if (selectedTag) {
    detailedBalances = balances!.reduce(
      (acc, balance) => {
        const myPOVEntity = allChildrenTags.includes(
          balance.selectedEntity.tagName,
        )
          ? balance.otherEntity
          : balance.selectedEntity;
        let entityEntry = acc.find(
          (entry) => entry.entity.id === myPOVEntity.id,
        );

        if (!entityEntry) {
          entityEntry = {
            entity: myPOVEntity,
            data: [],
          };
          acc.push(entityEntry);
        }

        const balanceMultiplier =
          entityEntry.entity.id === balance.selectedEntityId ? -1 : 1;

        let dataEntry = entityEntry.data.find(
          (d) => d.currency === balance.currency,
        );

        if (!dataEntry) {
          dataEntry = {
            currency: balance.currency,
            balance: 0,
          };
          entityEntry.data.push(dataEntry);
        }

        dataEntry.balance += balance.balance * balanceMultiplier;

        return acc;
      },
      [] as z.infer<typeof transformedBalancesSchema>[],
    );
  }

  const {
    results: filteredBalances,
    searchValue,
    setSearchValue,
  } = useSearch<(typeof detailedBalances)[0]>({
    dataSet: detailedBalances,
    keys: ["entity.name"],
  });

  const balancesToRender = filteredBalances.slice(
    pageSize * (detailedBalancesPage - 1),
    pageSize * detailedBalancesPage,
  );

  return (
    <div className="flex flex-col space-y-4">
      <h1 className="text-3xl font-semibold tracking-tighter">Entidades</h1>
      <div className="grid-cols grid grid-cols-2 gap-4 lg:grid-cols-3">
        {!isBalanceLoading ? (
          transformedBalances.map((item) => (
            <Card key={item.entity.id} className="min-w-[300px]">
              <CardHeader>
                <Link
                  prefetch={false}
                  href={{
                    pathname: "/cuentas",
                    query: {
                      cuenta: "cuenta_corriente",
                      entidad: item.entity.id,
                    },
                  }}
                >
                  <CardTitle>{item.entity.name}</CardTitle>
                </Link>
                <CardDescription>
                  {capitalizeFirstLetter(item.entity.tagName)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-2">
                  {item.data.map((balances) => (
                    <div key={balances.currency} className="grid grid-cols-2">
                      <p className="col-span-1">
                        {balances.currency.toUpperCase()}
                      </p>
                      {!isRefetching ? (
                        <p className="text-xl font-bold">
                          ${" "}
                          {new Intl.NumberFormat("es-AR").format(
                            balances.balance,
                          )}
                        </p>
                      ) : (
                        <p>Cargando...</p>
                      )}
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
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Buscar"
            className="w-32"
          />
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
          {Math.round(filteredBalances.length / pageSize) >=
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
        {!isBalanceLoading ? (
          balancesToRender.map((item, index) => (
            <div
              key={item.entity.id}
              className={cn(
                "grid grid-cols-6 justify-items-center rounded-xl font-semibold",
                index % 2 === 0 ? "bg-muted p-3" : "bg-white",
              )}
            >
              <p className="p-2">{item.entity.name}</p>
              {currencyOrder.map((currency) => {
                const matchingBalance = item.data.find(
                  (balance) => balance.currency === currency,
                );

                return matchingBalance ? (
                  !isRefetching ? (
                    <p
                      onClick={() => {
                        if (
                          selectedCurrency !== currency ||
                          destinationEntityId !== item.entity.id
                        ) {
                          setSelectedCurrency(currency);
                          setDestinationEntityId(item.entity.id);
                        } else {
                          setSelectedCurrency(undefined);
                          setDestinationEntityId(undefined);
                        }
                      }}
                      key={currency}
                      className={cn(
                        "rounded-full p-2 transition-all hover:scale-105 hover:cursor-default hover:bg-primary hover:text-white hover:shadow-md",
                        selectedCurrency === currency &&
                          destinationEntityId === item.entity.id &&
                          "bg-primary text-white shadow-md",
                      )}
                    >
                      {new Intl.NumberFormat("es-AR").format(
                        matchingBalance.balance,
                      )}
                    </p>
                  ) : (
                    <p>Cargando...</p>
                  )
                ) : (
                  <p></p>
                );
              })}
            </div>
          ))
        ) : (
          <Lottie animationData={loadingJson} className="h-24" loop={true} />
        )}
      </div>
    </div>
  );
};

export default Balances;
