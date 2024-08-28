"use client";

import { useTheme } from "next-themes";
import { type FC } from "react";
import { z } from "zod";
import { isDarkEnough, lightenColor, numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currenciesOrder } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { type RouterOutputs } from "~/trpc/shared";
import { Icons } from "../components/ui/Icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Button } from "../components/ui/button";
import { api } from "~/trpc/react";
import { toast } from "sonner";

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
  const { mutateAsync: getUrlAsync, isLoading: isUrlLoading } =
    api.files.detailedBalancesFile.useMutation({
      onSuccess(newOperation) {
        const link = document.createElement("a");
        link.href = newOperation.downloadUrl;
        link.download = newOperation.filename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
      onError(err) {
        toast.error("Error al generar el archivo", {
          description: err.message,
        });
      },
    });

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
          // Handle entities with the same tag
          const myPOVEntity =
            selectedTag === balance.selectedEntity.tagName
              ? balance.selectedEntity
              : balance.otherEntity;

          const myOtherEntity =
            selectedTag === balance.selectedEntity.tagName
              ? balance.otherEntity
              : balance.selectedEntity;

          // Process myOtherEntity
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

            // Update totals
            let totalEntry = acc.totals.find(
              (t) => t.currency === dataEntry?.currency,
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

          // Process myPOVEntity
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

          // Update totals
          let totalEntry = acc.totals.find(
            (t) => t.currency === dataEntry?.currency,
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
    setDestinationEntityId,
    originEntityId,
    setMovementsTablePage,
  } = useCuentasStore();

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-start gap-x-4">
        <h1 className="text-3xl font-semibold tracking-tighter">Entidades</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {!isUrlLoading ? (
              <Button variant="outline">Generar</Button>
            ) : (
              <p>Cargando...</p>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Extensión</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => {
                  const promise = getUrlAsync({
                    entityId: selectedEntityId,
                    entityTag: selectedTag,
                    detailedBalances: [
                      ...transformedBalances.tableData.map((d) => ({
                        entity: d.entity,
                        data: d.data.map((detail) => ({
                          currency: detail.currency,
                          balance:
                            detail.currency === "usdt" ? 0 : detail.balance,
                        })),
                      })),
                      {
                        entity: {
                          id: 0,
                          name: "Total",
                          tagName: "Maika",
                        },
                        data: transformedBalances.totals.map((t) => ({
                          currency: t.currency,
                          balance: t.total,
                        })),
                      },
                    ],
                    fileType: "pdf",
                  });

                  toast.promise(promise, {
                    loading: "Generando archivo...",
                    success(data) {
                      return `Archivo generado: ${data.filename}`;
                    },
                    error() {
                      return `Error al generar el archivo`;
                    },
                  });
                }}
              >
                <Icons.pdf className="h-4" />
                <span>PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const promise = getUrlAsync({
                    entityId: selectedEntityId,
                    entityTag: selectedTag,
                    detailedBalances: [
                      ...transformedBalances.tableData.map((d) => ({
                        entity: d.entity,
                        data: d.data.map((detail) => ({
                          currency: detail.currency,
                          balance:
                            detail.currency === "usdt" ? 0 : detail.balance,
                        })),
                      })),
                      {
                        entity: {
                          id: 0,
                          name: "Total",
                          tagName: "Maika",
                        },
                        data: transformedBalances.totals.map((t) => ({
                          currency: t.currency,
                          balance: t.total,
                        })),
                      },
                    ],
                    fileType: "csv",
                  });

                  toast.promise(promise, {
                    loading: "Generando archivo...",
                    success(data) {
                      return `Archivo generado: ${data.filename}`;
                    },
                  });
                }}
              >
                <Icons.excel className="h-4" />
                <span>Excel</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
                  setDestinationEntityId(undefined);
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
                      setDestinationEntityId(undefined);
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
