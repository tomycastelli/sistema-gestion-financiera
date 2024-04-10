"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { type FC } from "react";
import {
  Bar,
  BarChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { generateTableData } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currenciesOrder, dateFormatting } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { DataTable } from "./DataTable";

interface SummarizedBalancesProps {
  initialBalancesForCard: RouterOutputs["movements"]["getBalancesByEntitiesForCard"];
  initialBalancesForCardInput: RouterInputs["movements"]["getBalancesByEntitiesForCard"];
  initialMovements: RouterOutputs["movements"]["getCurrentAccounts"];
  selectedTag: string | undefined;
  selectedEntityId: number | undefined;
  tags: RouterOutputs["tags"]["getAll"];
}

const SummarizedBalances: FC<SummarizedBalancesProps> = ({
  initialBalancesForCard,
  initialBalancesForCardInput,
  initialMovements,
  selectedTag,
  selectedEntityId,
  tags,
}) => {
  const {
    selectedTimeframe,
    selectedCurrency,
    setSelectedCurrency,
    isInverted,
    timeMachineDate,
  } = useCuentasStore();

  const dayInPast = moment(timeMachineDate).format(dateFormatting.day);

  const { data: balancesForCard } =
    api.movements.getBalancesByEntitiesForCard.useQuery(
      {
        ...initialBalancesForCardInput,
        dayInPast,
      },
      {
        initialData: initialBalancesForCard,
        refetchOnWindowFocus: false,
      },
    );

  const { data: balancesHistory } = api.movements.getBalancesHistory.useQuery({
    currency: selectedCurrency,
    timeRange: selectedTimeframe,
    entityId: selectedEntityId,
    entityTag: selectedTag,
    dayInPast,
  });

  const queryInput: RouterInputs["movements"]["getCurrentAccounts"] = {
    currency: selectedCurrency,
    pageSize: 5,
    pageNumber: 1,
    entityTag: selectedTag,
    entityId: selectedEntityId,
  };

  queryInput.dayInPast = dayInPast;

  const { data: movements, isLoading } =
    api.movements.getCurrentAccounts.useQuery(queryInput, {
      initialData: initialMovements,
      refetchOnWindowFocus: false,
    });

  const tableData = generateTableData(
    movements.movements,
    selectedEntityId,
    selectedTag,
    tags,
  );

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
      accessorKey: "account",
      header: "Cuenta",
      cell: ({ row }) => {
        let cuenta = "";
        if (row.getValue("account") === true) {
          cuenta = "Caja";
        }
        if (row.getValue("account") === false) {
          cuenta = "Cuenta corriente";
        }
        return <p className="font-medium">{cuenta}</p>;
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
    {
      accessorKey: "balance",
      header: () => <div className="text-right">Saldo</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("balance"));
        const formatted = new Intl.NumberFormat("es-AR").format(amount);
        return (
          <div className="text-right font-medium">
            {" "}
            <span className="font-light text-muted-foreground">
              {tableData[row.index]!.currency.toUpperCase()}
            </span>{" "}
            {formatted}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const movement = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem>
                <Link
                  prefetch={false}
                  href={{
                    pathname: `/operaciones/gestion/${movement.operationId}`,
                    query: { row: row.getValue("id") },
                  }}
                  className="flex flex-row items-center space-x-1"
                >
                  <p>Ver operación</p>
                  <Icons.externalLink className="h-4 text-black" />
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                Ver usuario{" "}
                {/* menu con usuarios que participaron subiendo, confirmando, actualizando */}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // @ts-ignore
  const renderCleanerText = (value: string) => {
    return <span>{value.replace(/_/g, " ")}</span>;
  };

  const renderCleanerTextAndNumber = (value: number, name: string) => {
    const valueString = new Intl.NumberFormat("es-AR").format(value);
    const nameString = name.replace(/_/g, " ");
    return [valueString, nameString];
  };

  return (
    <div className="flex flex-col space-y-8">
      <div className="grid w-full grid-cols-2 gap-8 lg:grid-cols-3">
        {balancesForCard &&
          balancesForCard
            .sort(
              (a, b) =>
                currenciesOrder.indexOf(a.currency) -
                currenciesOrder.indexOf(b.currency),
            )
            .map((item) => (
              <Card
                key={item.currency}
                onClick={() => setSelectedCurrency(item.currency)}
                className={cn(
                  "transition-all hover:scale-105 hover:cursor-pointer hover:shadow-md hover:shadow-primary",
                  item.currency === selectedCurrency &&
                  "border-2 border-primary",
                )}
              >
                <CardHeader>
                  <CardTitle>{item.currency.toUpperCase()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col space-y-4">
                    {item.balances
                      .sort((a, b) =>
                        a.account === b.account ? 0 : a.account ? 1 : -1,
                      )
                      .map((balance) => (
                        <div
                          key={balance.amount}
                          className="flex flex-col space-y-2"
                        >
                          <p>{balance.account ? "Caja" : "Cuenta corriente"}</p>
                          <p className="text-xl font-semibold">
                            {new Intl.NumberFormat("es-AR").format(
                              !isInverted ? balance.amount : -balance.amount,
                            )}
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
      <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-2">
        {selectedCurrency ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Resumen{" "}
                {selectedTimeframe === "day"
                  ? "Diario"
                  : selectedTimeframe === "week"
                    ? "Semanal"
                    : selectedTimeframe === "month"
                      ? "Mensual"
                      : selectedTimeframe === "year"
                        ? "Anual"
                        : ""}
              </CardTitle>
              <CardDescription>
                {selectedCurrency.toUpperCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-full w-full items-center justify-center">
              {balancesHistory && (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={balancesHistory.map((b) => ({
                      ...b,
                      Caja: parseFloat(
                        !isInverted ? b.cash.toFixed(2) : (-b.cash).toFixed(2),
                      ),
                      Cuenta_Corriente: parseFloat(
                        !isInverted
                          ? b.current_account.toFixed(2)
                          : (-b.current_account).toFixed(2),
                      ),
                    }))}
                  >
                    <XAxis
                      dataKey="datestring"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ReferenceLine y={0} stroke="#888888" strokeWidth={1.5} />
                    <YAxis
                      stroke="#888888"
                      width={90}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      isAnimationActive={true}
                      formatter={renderCleanerTextAndNumber}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={72}
                      formatter={renderCleanerText}
                    />
                    <Bar
                      dataKey="Caja"
                      fill="#16A149"
                      radius={[4, 4, 0, 0]}
                      legendType="circle"
                      label="Caja"
                    />
                    <Bar
                      dataKey="Cuenta_Corriente"
                      legendType="circle"
                      label="Cuenta corriente"
                      fill="#E87B35"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Elegir divisa</CardTitle>
            </CardHeader>
          </Card>
        )}
        {selectedCurrency ? (
          <Card>
            <CardHeader>
              <CardTitle>Movimientos recientes</CardTitle>
              <CardDescription>
                {selectedCurrency.toUpperCase()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Cargando...</p>
              ) : movements.totalRows > 0 ? (
                <DataTable
                  columns={columns}
                  data={tableData.map((row) => {
                    if (!isInverted) {
                      return row;
                    } else {
                      return {
                        ...row,
                        selectedEntity: row.otherEntity,
                        selectedEntityId: row.otherEntityId,
                        otherEntity: row.selectedEntity,
                        otherEntityId: row.otherEntityId,
                        ingress: row.egress,
                        egress: row.ingress,
                        balance: -row.balance,
                      };
                    }
                  })}
                />
              ) : (
                <p>Seleccioná una divisa</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Elegir divisa</CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SummarizedBalances;
