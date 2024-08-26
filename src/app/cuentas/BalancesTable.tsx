"use client";

import { useTheme } from "next-themes";
import { type FC } from "react";
import { z } from "zod";
import { isDarkEnough, lightenColor, numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currenciesOrder } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { type RouterOutputs } from "~/trpc/shared";

const transformedBalancesSchema = z.object({
  tableData: z.array(
    z.object({
      entity: z.object({
        id: z.number().int(),
        name: z.string(),
        tagName: z.string(),
      }),
      data: z.array(z.object({ currency: z.string(), balance: z.number() })),
    }),
  ),
  totals: z.array(z.object({ currency: z.string(), total: z.number() })),
});

interface BalancesTableProps {
  balances: RouterOutputs["movements"]["getBalancesByEntities"];
  isInverted: boolean;
  accountType: boolean;
  uiColor: string | undefined;
  isFetching: boolean;
  selectedEntityId: number | undefined;
  selectedTag: string | undefined;
}

const BalancesTable: FC<BalancesTableProps> = ({
  balances,
  isInverted,
  isFetching,
  uiColor,
  selectedEntityId,
  selectedTag,
}) => {
  const transformedBalances: z.infer<typeof transformedBalancesSchema> =
    balances.reduce(
      (acc, balance) => {
        if (selectedEntityId) {
          let entityEntry = acc.tableData.find(
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
            acc.tableData.push(entityEntry);
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
            let otherEntityEntry = acc.tableData.find(
              (entry) => entry.entity.id === myOtherEntity.id,
            );

            if (!otherEntityEntry) {
              otherEntityEntry = {
                entity: myOtherEntity,
                data: [],
              };
              acc.tableData.push(otherEntityEntry);
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

          let entityEntry = acc.tableData.find(
            (entry) => entry.entity.id === myPOVEntity.id,
          );

          if (!entityEntry) {
            entityEntry = {
              entity: myPOVEntity,
              data: [],
            };
            acc.tableData.push(entityEntry);
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

          // Ahora sumo a totales
          let totalEntry = acc.totals.find(
            (t) => t.currency === dataEntry!.currency,
          );
          if (!totalEntry) {
            totalEntry = {
              currency: dataEntry.currency,
              total: 0,
            };
            acc.totals.push(totalEntry);
          }

          totalEntry.total += balance.balance * balanceMultiplier;
        }

        return acc;
      },
      { tableData: [], totals: [] } as z.infer<
        typeof transformedBalancesSchema
      >,
    );

  const columnAmount = currenciesOrder.length + 1;

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const {
    selectedCurrency,
    setSelectedCurrency,
    setOriginEntityId,
    originEntityId,
    setMovementsTablePage,
  } = useCuentasStore();

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between gap-x-4">
        <h1 className="text-3xl font-semibold tracking-tighter">Entidades</h1>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div
          style={{
            borderColor: uiColor,
            gridTemplateColumns: `repeat(${columnAmount}, minmax(0, 1fr))`,
          }}
          className="grid justify-items-center rounded-xl border-2 p-2"
        >
          <p className="col-span-1">Entidad</p>
          {currenciesOrder.map((currency) => (
            <p key={currency} className="col-span-1">
              {currency.toUpperCase()}
            </p>
          ))}
        </div>
        {transformedBalances.tableData.map((item, index) => (
          <div
            key={item.entity.id}
            style={{
              backgroundColor: uiColor
                ? index % 2 === 0
                  ? lightenColor(uiColor, isDark ? 60 : 20)
                  : lightenColor(uiColor, isDark ? 40 : 10)
                : undefined,
              gridTemplateColumns: `repeat(${columnAmount}, minmax(0, 1fr))`,
            }}
            className="grid justify-items-center rounded-xl p-3 text-lg font-semibold"
          >
            <div
              onClick={() => {
                if (originEntityId === item.entity.id && !selectedCurrency) {
                  setOriginEntityId(undefined);
                  setMovementsTablePage(1);
                } else {
                  setSelectedCurrency(undefined);
                  setOriginEntityId(item.entity.id);
                  setMovementsTablePage(1);
                }
              }}
              className={cn(
                "col-span-1 flex items-center justify-center rounded-full p-2 transition-all hover:scale-105 hover:cursor-default hover:bg-primary hover:text-white hover:shadow-md",
                !selectedCurrency &&
                  originEntityId == item.entity.id &&
                  "bg-primary text-white shadow-md",
              )}
            >
              <p>{item.entity.name}</p>
            </div>
            {currenciesOrder.map((currency) => {
              const matchingBalance = item.data.find(
                (balance) => balance.currency === currency,
              );

              return matchingBalance && currency !== "usdt" ? (
                <div
                  onClick={() => {
                    if (
                      selectedCurrency !== currency ||
                      originEntityId !== item.entity.id
                    ) {
                      setSelectedCurrency(currency);
                      setOriginEntityId(item.entity.id);
                      setMovementsTablePage(1);
                    } else {
                      setSelectedCurrency(undefined);
                      setOriginEntityId(undefined);
                      setMovementsTablePage(1);
                    }
                  }}
                  key={currency}
                  style={{
                    backgroundColor:
                      selectedCurrency === currency &&
                      originEntityId === item.entity.id
                        ? uiColor
                        : undefined,
                  }}
                  className={cn(
                    "col-span-1 flex items-center justify-center rounded-full p-2 transition-all hover:scale-105 hover:cursor-default hover:bg-primary hover:text-white hover:shadow-md",
                    selectedCurrency === currency &&
                      originEntityId === item.entity.id &&
                      uiColor &&
                      isDarkEnough(uiColor) &&
                      "bg-primary text-white shadow-md",
                    selectedCurrency === currency &&
                      originEntityId === item.entity.id &&
                      "bg-primary text-white shadow-md",
                  )}
                >
                  {!isFetching ? (
                    <p
                      className={cn(
                        matchingBalance.balance !== 0
                          ? !isInverted
                            ? matchingBalance.balance > 0
                              ? "text-green"
                              : "text-red"
                            : -matchingBalance.balance > 0
                            ? "text-green"
                            : "text-red"
                          : undefined,
                      )}
                    >
                      {numberFormatter(
                        !isInverted
                          ? matchingBalance.balance
                          : -matchingBalance.balance,
                      )}
                    </p>
                  ) : (
                    <p>Cargando...</p>
                  )}
                </div>
              ) : (
                <p className="col-span-1" key={currency}></p>
              );
            })}
          </div>
        ))}
        <div
          style={{
            borderColor: uiColor,
            gridTemplateColumns: `repeat(${columnAmount}, minmax(0, 1fr))`,
          }}
          className="grid justify-items-center border-t-2 p-4 text-xl font-semibold"
        >
          <p className="col-span-1">Total</p>
          {currenciesOrder.map((currency) => {
            const total =
              transformedBalances.totals.find((t) => t.currency === currency)
                ?.total ?? 0;
            return (
              <p
                key={currency}
                className={cn(
                  "col-span-1",
                  total !== 0
                    ? !isInverted
                      ? total > 0
                        ? "text-green"
                        : "text-red"
                      : -total > 0
                      ? "text-green"
                      : "text-red"
                    : undefined,
                )}
              >
                {numberFormatter(!isInverted ? total : -total)}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BalancesTable;
