"use client";

import { useState, type FC } from "react";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import Link from "next/link";
import { capitalizeFirstLetter, numberFormatter } from "~/lib/functions";
import { currenciesOrder } from "~/lib/variables";
import { type RouterOutputs } from "~/trpc/shared";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";

const transformedBalancesSchema = z.object({
  entity: z.object({
    id: z.number().int(),
    name: z.string(),
    tagName: z.string(),
  }),
  data: z.array(z.object({ currency: z.string(), balance: z.number() })),
});

const groupedTagBalancesSchema = z.object({
  tagName: z.string(),
  data: z.array(z.object({ currency: z.string(), balance: z.number() })),
});

interface BalancesCardsProps {
  balances: RouterOutputs["movements"]["getBalancesByEntities"];
  isInverted: boolean;
  accountType: boolean;
  selectedEntityId: number | undefined;
  selectedTag: string | undefined;
}

const BalancesCards: FC<BalancesCardsProps> = ({
  balances,
  isInverted,
  accountType,
  selectedEntityId,
  selectedTag,
}) => {
  const [isGrouped, setIsGrouped] = useState<boolean>(true);

  const transformedBalances: z.infer<typeof transformedBalancesSchema>[] =
    balances.reduce(
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
          // Quiero que si hay un balance de entidades del mismo Tag, se sume como corresponda en cada entidad, osea que afecte dos entityEntry
          const myPOVEntity =
            selectedTag === balance.selectedEntity.tagName
              ? balance.selectedEntity
              : balance.otherEntity;

          const myOtherEntity =
            selectedTag === balance.selectedEntity.tagName
              ? balance.otherEntity
              : balance.selectedEntity;

          if (myOtherEntity.tagName === myPOVEntity.tagName) {
            let otherEntityEntry = acc.find(
              (entry) => entry.entity.id === myOtherEntity.id,
            );

            if (!otherEntityEntry) {
              otherEntityEntry = {
                entity: myOtherEntity,
                data: [],
              };
              acc.push(otherEntityEntry);
            }

            const balanceMultiplier =
              otherEntityEntry.entity.id === balance.selectedEntityId ? 1 : -1;

            let dataEntry = otherEntityEntry.data.find(
              (d) => d.currency === balance.currency,
            );
            if (!dataEntry) {
              dataEntry = {
                currency: balance.currency,
                balance: 0,
              };
              otherEntityEntry.data.push(dataEntry);
            }

            dataEntry.balance += balance.balance * balanceMultiplier;
          }

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

  const groupedTagBalances = transformedBalances.reduce(
    (acc, balance) => {
      const myPOVTag = balance.entity.tagName;

      let existingEntry = acc.find(
        (obj) => obj.tagName === balance.entity.tagName,
      );

      if (!existingEntry) {
        existingEntry = {
          tagName: myPOVTag,
          data: [],
        };
        acc.push(existingEntry);
      }

      balance.data.forEach((b) => {
        let dataEntry = existingEntry!.data.find(
          (d) => d.currency === b.currency,
        );

        if (!dataEntry) {
          dataEntry = {
            balance: 0,
            currency: b.currency,
          };

          existingEntry!.data.push(dataEntry);
        }

        dataEntry.balance += b.balance;
      });

      return acc;
    },
    [] as z.infer<typeof groupedTagBalancesSchema>[],
  );
  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between gap-x-4">
        <h1 className="text-3xl font-semibold tracking-tighter">Entidades</h1>
        <div className="flex flex-col gap-y-1">
          <Label>Agrupado</Label>
          <Button variant="outline" onClick={() => setIsGrouped(!isGrouped)}>
            <Switch checked={isGrouped} />
          </Button>
        </div>
      </div>
      <div className="grid-cols grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isGrouped
          ? groupedTagBalances.map((item) => (
              <Card
                key={item.tagName}
                className="min-w-[300px] transition-all hover:scale-105 hover:shadow-md hover:shadow-primary"
              >
                <Link
                  prefetch={false}
                  href={{
                    pathname: "/cuentas",
                    query: {
                      cuenta: accountType ? "caja" : "cuenta_corriente",
                      tag: item.tagName,
                    },
                  }}
                >
                  <CardHeader>
                    <CardTitle>{item.tagName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col space-y-2">
                      {item.data
                        .sort(
                          (a, b) =>
                            currenciesOrder.indexOf(a.currency) -
                            currenciesOrder.indexOf(b.currency),
                        )
                        .map((balances) => (
                          <div
                            key={balances.currency}
                            className="grid grid-cols-3"
                          >
                            <p className="col-span-1">
                              {balances.currency.toUpperCase()}
                            </p>
                            <p className="col-span-2 text-xl font-bold">
                              ${" "}
                              {numberFormatter(
                                !isInverted
                                  ? balances.balance
                                  : -balances.balance,
                              )}
                            </p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))
          : transformedBalances
              .sort((a, b) => a.entity.name.localeCompare(b.entity.name))
              .map((item) => (
                <Card
                  key={item.entity.id}
                  className="min-w-[300px] transition-all hover:scale-105 hover:shadow-md hover:shadow-primary"
                >
                  <Link
                    prefetch={false}
                    href={{
                      pathname: "/cuentas",
                      query: {
                        cuenta: accountType ? "caja" : "cuenta_corriente",
                        entidad: item.entity.id,
                      },
                    }}
                  >
                    <CardHeader>
                      <CardTitle>{item.entity.name}</CardTitle>
                      <CardDescription>
                        {capitalizeFirstLetter(item.entity.tagName)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col space-y-2">
                        {item.data
                          .sort(
                            (a, b) =>
                              currenciesOrder.indexOf(a.currency) -
                              currenciesOrder.indexOf(b.currency),
                          )
                          .map((balances) => (
                            <div
                              key={balances.currency}
                              className="grid grid-cols-3"
                            >
                              <p className="col-span-1">
                                {balances.currency.toUpperCase()}
                              </p>
                              <p className="col-span-2 text-xl font-bold">
                                ${" "}
                                {numberFormatter(
                                  !isInverted
                                    ? balances.balance
                                    : -balances.balance,
                                )}
                              </p>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
      </div>
    </div>
  );
};

export default BalancesCards;
