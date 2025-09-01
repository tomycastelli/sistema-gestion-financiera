"use client";

import type { User } from "lucia";
import moment from "moment";
import { useTheme } from "next-themes";
import { type FC } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { lightenColor, numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currenciesOrder } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";

const transformedBalancesSchema = z.object({
  tableData: z.array(
    z.object({
      entity: z.object({
        id: z.number().int(),
        name: z.string(),
        tagName: z.string(),
        status: z.boolean(),
      }),
      data: z.array(z.object({ currency: z.string(), balance: z.number() })),
    }),
  ),
  totals: z.array(z.object({ currency: z.string(), total: z.number() })),
});

interface CashBalancesTableProps {
  isInverted: boolean;
  uiColor: string | undefined;
  selectedEntityId: number | undefined;
  selectedTag: string | undefined;
  latestExchangeRates: RouterOutputs["exchangeRates"]["getLatestExchangeRates"];
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  dayInPast: string | undefined;
  user: User | null;
  main_name: string;
  linkId: number | null;
  linkToken: string | null;
  entities: RouterOutputs["entities"]["getAll"];
}

const CashBalancesTable: FC<CashBalancesTableProps> = ({
  isInverted,
  uiColor,
  selectedEntityId,
  selectedTag,
  latestExchangeRates,
  dayInPast,
  initialBalances,
  user,
  main_name,
  linkId,
  linkToken,
  entities,
}) => {
  const {
    data: balances,
    isFetching,
    refetch,
  } = api.movements.getBalancesByEntities.useQuery(
    {
      linkId,
      account: true,
      entityId: selectedEntityId,
      dayInPast,
      entityTag: selectedTag,
      linkToken,
      balanceType: "2",
    },
    { initialData: initialBalances, refetchOnWindowFocus: false },
  );

  const unifyAmount = (
    currency: string,
    amount: number,
    type: "entity" | "total",
  ) => {
    if (latestExchangeRates.length === 0) return 0;
    if (currency === "usd") return amount;
    const rate =
      latestExchangeRates.find((rate) => rate.currency === currency)?.rate ?? 0;
    if (currency === "usdt") {
      if (type === "entity") return 0;
      return amount * (1 + rate / 100);
    } else if (currency === "eur") {
      return amount * rate;
    }
    return amount / rate;
  };

  const transformBalances = (
    balances: typeof initialBalances,
  ): z.infer<typeof transformedBalancesSchema> => {
    // Group balances by entity
    const entityBalances = balances.reduce(
      (acc, balance) => {
        const entityId = balance.ent_a?.id ?? 0;
        if (!acc[entityId]) {
          acc[entityId] = {
            entity: {
              id: entityId,
              name:
                entities.find((e) => e.id === entityId)?.name ?? "Sin nombre",
              tagName:
                entities.find((e) => e.id === entityId)?.name ?? "Sin nombre",
              status: true,
            },
            data: [],
          };
        }
        acc[entityId]!.data.push({
          currency: balance.currency,
          balance: balance.amount,
        });
        return acc;
      },
      {} as Record<
        number,
        {
          entity: {
            id: number;
            name: string;
            tagName: string;
            status: boolean;
          };
          data: { currency: string; balance: number }[];
        }
      >,
    );

    console.log({ balances });

    // Calculate totals for each currency and add unified totals
    const totals = balances.reduce(
      (acc, balance) => {
        const existingTotal = acc.find((t) => t.currency === balance.currency);
        if (existingTotal) {
          existingTotal.total += balance.amount;
        } else {
          acc.push({
            currency: balance.currency,
            total: balance.amount,
          });
        }
        return acc;
      },
      [] as { currency: string; total: number }[],
    );

    // Add unified total
    const unifiedTotal = totals.reduce((sum, { currency, total }) => {
      return sum + unifyAmount(currency, total, "total");
    }, 0);
    totals.push({ currency: "unified", total: unifiedTotal });

    // Add unified balance for each entity
    const tableData = Object.values(entityBalances).map((entity) => {
      const unifiedBalance = entity.data.reduce(
        (sum, { currency, balance }) => {
          return sum + unifyAmount(currency, balance, "entity");
        },
        0,
      );
      return {
        ...entity,
        data: [
          ...entity.data,
          { currency: "unified", balance: unifiedBalance },
        ],
      };
    });

    return {
      tableData,
      totals,
    };
  };

  const transformedBalances = transformBalances(balances);

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

  const userCanUnify =
    user?.permissions?.some(
      (p) => p.name === "ADMIN" || p.name === "UNIFIED_CURRENCIES_VISUALIZE",
    ) ?? false;

  const tableCurrencies = userCanUnify
    ? [...currenciesOrder, "unified"]
    : currenciesOrder;

  const columnAmount = tableCurrencies.length + 1;

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const {
    selectedCurrency,
    setSelectedCurrency,
    setOriginEntityId,
    setDestinationEntityId,
    originEntityId,
    setMovementsTablePage,
    setGroupInTag,
  } = useCuentasStore();

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-start gap-x-4">
        <h1 className="text-3xl font-semibold tracking-tighter">Entidades</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {!isUrlLoading ? (
              <Button variant="outline" tooltip="Descargar">
                <Icons.download className="h-5" />
              </Button>
            ) : (
              <Skeleton className="h-8 w-12" />
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
                        entity: {
                          ...d.entity,
                          enabled: true,
                          category: undefined,
                        },
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
                          tagName: main_name,
                          status: true,
                          enabled: true,
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
                        entity: {
                          ...d.entity,
                          enabled: true,
                          category: undefined,
                        },
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
                          tagName: main_name,
                          status: true,
                          enabled: true,
                        },
                        data: transformedBalances.totals.map((t) => ({
                          currency: t.currency,
                          balance: t.total,
                        })),
                      },
                    ],
                    fileType: "xlsx",
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
          {tableCurrencies.map((currency) => (
            <p key={currency} className="col-span-1">
              {currency === "unified" ? "Unificado" : currency.toUpperCase()}
            </p>
          ))}
        </div>
        {transformedBalances.tableData
          .sort((a, b) => a.entity.id - b.entity.id)
          .map((item, index) => (
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
              <Button
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
                  void refetch();
                }}
                variant="outline"
                className="border-transparent text-xl"
              >
                <p>{item.entity.name}</p>
              </Button>
              {tableCurrencies.map((currency) => {
                const matchingBalance = item.data.find(
                  (balance) => balance.currency === currency,
                );

                return matchingBalance && currency !== "usdt" ? (
                  <Button
                    onClick={() => {
                      if (currency === "unified") return;
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
                      void refetch();
                    }}
                    key={currency}
                    variant="outline"
                    className="border-transparent text-xl"
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
                      <Skeleton className="h-8 w-14" />
                    )}
                  </Button>
                ) : (
                  <p className="col-span-1" key={currency}></p>
                );
              })}
            </div>
          ))}
        {selectedTag && (
          <div
            style={{
              borderColor: uiColor,
              gridTemplateColumns: `repeat(${columnAmount}, minmax(0, 1fr))`,
            }}
            className="grid justify-items-center border-t-2 p-4 text-xl font-semibold"
          >
            <p className="col-span-1">Total</p>
            {tableCurrencies.map((currency) => {
              const total =
                transformedBalances.totals.find((t) => t.currency === currency)
                  ?.total ?? 0;
              return currency === "unified" ? (
                <Tooltip key={currency}>
                  <TooltipTrigger>
                    <Button
                      key={currency}
                      variant="outline"
                      className="text-xl"
                    >
                      <p
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
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="flex flex-col gap-x-4">
                    {latestExchangeRates.map((r) => (
                      <p key={r.currency}>
                        {r.currency.toUpperCase()} - {numberFormatter(r.rate)}
                        {r.currency === "usdt" ? " %" : " $"} -{" "}
                        {moment(r.date).format("DD-MM-YYYY")}
                      </p>
                    ))}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  key={currency}
                  onClick={() => {
                    setOriginEntityId(undefined);
                    setDestinationEntityId(undefined);
                    setMovementsTablePage(1);
                    if (selectedCurrency === currency && !originEntityId) {
                      setSelectedCurrency(undefined);
                    } else {
                      if (currency === "usdt") {
                        setGroupInTag(true);
                      }
                      setSelectedCurrency(currency);
                    }
                    void refetch();
                  }}
                  variant="outline"
                  className="text-xl"
                >
                  <p
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
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CashBalancesTable;
