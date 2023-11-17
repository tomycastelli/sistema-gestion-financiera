"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { type FC } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateTotalAllEntities,
  getMonthKey,
  getWeekKey,
} from "~/lib/functions";
import { cn } from "~/lib/utils";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { DataTable } from "./DataTable";

interface SummarizedBalancesProps {
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  initialBalancesInput: RouterInputs["movements"]["getBalancesByEntities"];
  initialMovements: RouterOutputs["movements"]["getMovementsByCurrency"];
  movementsAmount: number;
  selectedTag: string | null;
  selectedEntityId: number | null;
}

const SummarizedBalances: FC<SummarizedBalancesProps> = ({
  initialBalances,
  initialBalancesInput,
  initialMovements,
  movementsAmount,
  selectedTag,
  selectedEntityId,
}) => {
  const { data: balances } = api.movements.getBalancesByEntities.useQuery(
    initialBalancesInput,
    {
      initialData: initialBalances,
      refetchOnWindowFocus: false,
    },
  );

  const { selectedTimeframe, selectedCurrency, setSelectedCurrency } =
    useCuentasStore();

  const queryInput: RouterInputs["movements"]["getMovementsByCurrency"] = {
    currency: selectedCurrency,
    limit: movementsAmount,
  };

  if (selectedTag) {
    queryInput.entityTag = selectedTag;
  } else if (selectedEntityId) {
    queryInput.entityId = selectedEntityId;
  }

  const { data: movements, isLoading } =
    api.movements.getMovementsByCurrency.useQuery(queryInput, {
      initialData: initialMovements,
      refetchOnReconnect: false,
    });

  const tableData = movements.map((movement) => {
    let otherEntity = { id: 0, name: "", tag: "" };
    let selectedEntity = { id: 0, name: "", tag: "" };

    if (selectedEntityId) {
      otherEntity =
        selectedEntityId !== movement.transaction.fromEntity.id
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;

      selectedEntity =
        selectedEntityId === movement.transaction.fromEntity.id
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;
    } else if (selectedTag) {
      otherEntity =
        movement.transaction.fromEntity.tag !== selectedTag
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;

      selectedEntity =
        movement.transaction.fromEntity.tag === selectedTag
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;
    }

    let ingress = 0;
    let egress = 0;

    if (selectedEntityId) {
      ingress =
        (selectedEntityId === movement.transaction.toEntity.id &&
          movement.direction === 1) ||
        (selectedEntityId === movement.transaction.fromEntity.id &&
          movement.direction === -1)
          ? movement.transaction.amount
          : 0;

      egress =
        (selectedEntityId === movement.transaction.toEntity.id &&
          movement.direction === -1) ||
        (selectedEntityId === movement.transaction.fromEntity.id &&
          movement.direction === 1)
          ? movement.transaction.amount
          : 0;
    } else if (selectedTag) {
      ingress =
        (movement.transaction.toEntity.tag === selectedTag &&
          movement.direction === 1) ||
        (movement.transaction.fromEntity.tag === selectedTag &&
          movement.direction === -1)
          ? movement.transaction.amount
          : 0;

      egress =
        (movement.transaction.toEntity.tag === selectedTag &&
          movement.direction === -1) ||
        (movement.transaction.fromEntity.tag === selectedTag &&
          movement.direction === 1)
          ? movement.transaction.amount
          : 0;
    }

    return {
      id: movement.id,
      type: movement.type,
      otherEntityId: otherEntity.id,
      otherEntity: otherEntity.name,
      selectedEntityId: selectedEntity.id,
      selectedEntity: selectedEntity.name,
      currency: movement.transaction.currency,
      ingress,
      egress,
      method: movement.transaction.method,
      status: movement.transaction.status,
      txType: movement.transaction.type,
    };
  });

  const columns: ColumnDef<(typeof tableData)[number]>[] = [
    {
      accessorKey: "id",
      header: "ID",
    },
    {
      accessorKey: "selectedEntity",
      header: "Origen",
    },
    {
      accessorKey: "otherEntity",
      header: "Entidad",
    },
    {
      accessorKey: "otherEntityId",
      header: "Entidad ID",
      filterFn: "equals",
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        let type = "";
        if (row.getValue("type") === "upload") {
          type = "Carga";
        }
        if (row.getValue("type") === "confirmation") {
          type = "Confirmación";
        }
        return <p className="font-medium">{type}</p>;
      },
    },
    {
      accessorKey: "currency",
      header: "Divisa",
      filterFn: "equals",
    },
    {
      accessorKey: "ingress",
      header: () => <div className="text-right">Entrada</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("ingress"));
        const formatted = new Intl.NumberFormat("es-AR").format(amount);
        return amount !== 0 ? (
          <div className="text-right font-medium">
            {" "}
            <span className="font-light text-muted-foreground">
              {tableData[row.index]!.currency.toUpperCase()}
            </span>{" "}
            {formatted}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: "egress",
      header: () => <div className="text-right">Salida</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("egress"));
        const formatted = new Intl.NumberFormat("es-AR").format(amount);
        return amount !== 0 ? (
          <div className="text-right font-medium">
            {" "}
            <span className="font-light text-muted-foreground">
              {tableData[row.index]!.currency.toUpperCase()}
            </span>{" "}
            {formatted}
          </div>
        ) : null;
      },
    },
  ];

  const toEntities = Array.from(
    new Set(tableData.map((item) => item.otherEntityId)),
  ).map((uniqueId) => {
    const matchingObject = tableData.find(
      (item) => item.otherEntityId === uniqueId,
    );
    if (matchingObject) {
      return {
        otherEntityId: matchingObject.otherEntityId,
        otherEntity: matchingObject.otherEntity,
      };
    }
  });

  const totals = calculateTotalAllEntities(balances, selectedTimeframe);

  // Define the type for the entries in the acc array
  type BarChartEntry = {
    currency: string;
    entries: { date: string; cash: number; current_account: number }[];
  };

  const barChartData = balances.reduce<BarChartEntry[]>((acc, entity) => {
    entity.balances.forEach((balance) => {
      const dateKey =
        selectedTimeframe === "daily"
          ? balance.date.toLocaleDateString("es-AR")
          : selectedTimeframe === "weekly"
          ? getWeekKey(balance.date)
          : getMonthKey(balance.date);

      const existingCurrencyEntry = acc.find(
        (entry) => entry.currency === balance.currency,
      );

      if (!existingCurrencyEntry) {
        acc.push({
          currency: balance.currency,
          entries: [
            {
              date: dateKey,
              cash: balance.status ? balance.amount : 0,
              current_account: !balance.status ? balance.amount : 0,
            },
          ],
        });
      } else {
        const existingDateEntry = existingCurrencyEntry.entries.find(
          (entry) => entry.date === dateKey,
        );

        if (!existingDateEntry) {
          existingCurrencyEntry.entries.push({
            date: dateKey,
            cash: balance.status ? balance.amount : 0,
            current_account: !balance.status ? balance.amount : 0,
          });
        } else {
          if (balance.status) {
            existingDateEntry.cash += balance.amount;
          } else {
            existingDateEntry.current_account += balance.amount;
          }
        }
      }
    });

    return acc;
  }, []);

  // Sort barChartData for each currency by date
  barChartData.forEach((entry) => {
    entry.entries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  });

  return (
    <div className="grid grid-cols-4 grid-rows-3 gap-8">
      <div className="col-span-4 row-span-1 grid grid-flow-col gap-8">
        {totals.map((total) => (
          <Card
            key={total.currency}
            onClick={() => setSelectedCurrency(total.currency)}
            className="transition-all hover:scale-105"
          >
            <CardHeader>
              <CardTitle>{total.currency.toUpperCase()}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                {total.balances.map((balance) => (
                  <div key={balance.amount} className="flex flex-col space-y-2">
                    <p>{balance.status ? "Caja" : "Cuenta corriente"}</p>
                    <div className="flex flex-row space-x-4">
                      <p className="text-xl font-bold">
                        ${" "}
                        {new Intl.NumberFormat("es-AR").format(balance.amount)}
                      </p>
                      <p
                        className={cn(
                          "text-lg font-semibold",
                          balance.amount - balance.beforeAmount > 0
                            ? "text-green"
                            : balance.amount - balance.beforeAmount < 0
                            ? "text-red"
                            : "text-slate-300",
                        )}
                      >
                        {(balance.amount - balance.beforeAmount > 0
                          ? "+"
                          : balance.amount - balance.beforeAmount < 0
                          ? ""
                          : " ") +
                          new Intl.NumberFormat("es-AR").format(
                            balance.amount - balance.beforeAmount,
                          )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="col-span-4 row-span-2 grid grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>
              Resumen{" "}
              {selectedTimeframe === "daily"
                ? "Diario"
                : selectedTimeframe === "weekly"
                ? "Semanal"
                : selectedTimeframe === "monthly"
                ? "Mensual"
                : ""}
            </CardTitle>
            <CardDescription>{selectedCurrency.toUpperCase()}</CardDescription>
          </CardHeader>
          <CardContent className="flex h-full w-full items-center justify-center">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={
                  barChartData.find(
                    (item) => item.currency === selectedCurrency,
                  )?.entries
                }
              >
                <XAxis
                  dataKey="date"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  width={90}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip isAnimationActive={true} />
                <Bar
                  dataKey="cash"
                  fill="#3662E3"
                  radius={[4, 4, 0, 0]}
                  legendType="circle"
                  label="Caja"
                />
                <Bar
                  dataKey="current_account"
                  legendType="circle"
                  label="Cuenta corriente"
                  fill="#E87B35"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Movimientos recientes</CardTitle>
            <CardDescription>{selectedCurrency.toUpperCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Cargando...</p>
            ) : (
              <DataTable
                columns={columns}
                data={tableData}
                toEntities={toEntities}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SummarizedBalances;
