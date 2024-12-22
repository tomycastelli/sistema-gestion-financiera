"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useEffect, type FC, useState } from "react";
import { formatNumberLabel, numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currencies, currenciesOrder, mvTypeFormatting } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";
import { Button } from "../components/ui/button";
import dynamic from "next/dynamic";
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { DataTable } from "./DataTable";
import LoadingAnimation from "../components/LoadingAnimation";
const OperationDrawer = dynamic(() => import("../components/OperationDrawer"));
import { type User } from "lucia";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
} from "recharts";
import moment from "moment";

interface SummarizedBalancesProps {
  initialBalancesForCard: RouterOutputs["movements"]["getBalancesByEntitiesForCard"];
  initialBalancesInput: RouterInputs["movements"]["getBalancesByEntitiesForCard"];
  initialMovements: RouterOutputs["movements"]["getCurrentAccounts"];
  selectedTag: string | undefined;
  selectedEntity: RouterOutputs["entities"]["getAll"][number] | undefined;
  tags: RouterOutputs["tags"]["getAll"];
  uiColor: string | undefined;
  dayInPast: string | undefined;
  mainTags: string[];
  entities: RouterOutputs["entities"]["getAll"];
  user: User | null;
  users: RouterOutputs["users"]["getAll"];
  accountingPeriodDate: Date;
  initialBalanceCharts: RouterOutputs["movements"]["balanceChart"];
}

const SummarizedBalances: FC<SummarizedBalancesProps> = ({
  initialBalancesForCard,
  initialBalancesInput,
  initialMovements,
  selectedTag,
  selectedEntity,
  uiColor,
  dayInPast,
  mainTags,
  entities,
  user,
  users,
  accountingPeriodDate,
  initialBalanceCharts,
}) => {
  const [balanceChartDays, setBalanceChartDays] = useState("30");

  const { data: balanceChart } = api.movements.balanceChart.useQuery(
    {
      daysBackAmount: parseInt(balanceChartDays),
      entityId: selectedEntity?.id,
      tagName: selectedTag,
      dayInPast: dayInPast ? new Date(dayInPast) : undefined,
    },
    {
      initialData: initialBalanceCharts,
      refetchOnWindowFocus: false,
    },
  );

  const { selectedCurrency, setSelectedCurrency, isInverted, setIsInverted } =
    useCuentasStore();

  useEffect(() => {
    if (selectedTag) {
      if (mainTags.includes(selectedTag)) {
        setIsInverted(false);
      } else {
        setIsInverted(true);
      }
    } else if (selectedEntity) {
      if (mainTags.includes(selectedEntity.tag.name)) {
        setIsInverted(false);
      } else {
        setIsInverted(true);
      }
    }
  }, [mainTags, selectedEntity, selectedTag, setIsInverted]);

  const { data: balances, isFetching } =
    api.movements.getBalancesByEntitiesForCard.useQuery(initialBalancesInput, {
      initialData: initialBalancesForCard,
      refetchOnWindowFocus: false,
    });

  const queryInput: RouterInputs["movements"]["getCurrentAccounts"] = {
    currency: selectedCurrency,
    pageSize: 5,
    pageNumber: 1,
    entityTag: selectedTag,
    entityId: selectedEntity?.id,
  };

  queryInput.dayInPast = dayInPast;

  const { data: movements, isLoading } =
    api.movements.getCurrentAccounts.useQuery(queryInput, {
      initialData: initialMovements,
      refetchOnWindowFocus: false,
    });

  const columns: ColumnDef<(typeof movements.movements)[number]>[] = [
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
        const rowType = row.getValue("type");
        if (typeof rowType === "string") {
          return <p className="font-medium">{mvTypeFormatting.get(rowType)}</p>;
        }
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
        const formatted = numberFormatter(amount);
        return amount !== 0 ? (
          <div className="text-right font-medium">
            {" "}
            <span className="font-light text-muted-foreground">
              {movements.movements[row.index]!.currency.toUpperCase()}
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
        const formatted = numberFormatter(amount);
        return amount !== 0 ? (
          <div className="text-right font-medium">
            {" "}
            <span className="font-light text-muted-foreground">
              {movements.movements[row.index]!.currency.toUpperCase()}
            </span>{" "}
            {formatted}
          </div>
        ) : null;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const movement = row.original;

        if (user)
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <OperationDrawer
                  entities={entities}
                  user={user}
                  opId={movement.operationId}
                  accountingPeriodDate={accountingPeriodDate}
                  mainTags={mainTags}
                  users={users}
                >
                  <Button variant="outline" className="">
                    <p>Operación {numberFormatter(movement.operationId)}</p>
                  </Button>
                </OperationDrawer>
              </DropdownMenuContent>
            </DropdownMenu>
          );
      },
    },
  ];

  return (
    <div className="flex flex-col space-y-8">
      <div className="grid w-full grid-cols-2 gap-8 lg:grid-cols-3">
        {!isFetching ? (
          balances
            .sort(
              (a, b) =>
                currenciesOrder.indexOf(a.currency) -
                currenciesOrder.indexOf(b.currency),
            )
            .map((item) => (
              <Card
                key={item.currency}
                onClick={() => {
                  if (selectedCurrency !== item.currency) {
                    setSelectedCurrency(item.currency);
                  } else {
                    setSelectedCurrency(undefined);
                  }
                }}
                style={{
                  borderColor:
                    item.currency === selectedCurrency ? uiColor : undefined,
                }}
                className={cn(
                  "border-2 transition-all hover:scale-105 hover:cursor-pointer hover:shadow-md hover:shadow-primary",
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
                          <p
                            className={cn(
                              "text-xl font-semibold",
                              balance.amount !== 0
                                ? !isInverted
                                  ? balance.amount > 0
                                    ? "text-green"
                                    : "text-red"
                                  : -balance.amount > 0
                                  ? "text-green"
                                  : "text-red"
                                : undefined,
                            )}
                          >
                            {numberFormatter(
                              balance.amount === 0
                                ? 0
                                : !isInverted
                                ? balance.amount
                                : -balance.amount,
                            )}
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))
        ) : (
          <div className="items-cente col-span-2 flex justify-center lg:col-span-3">
            <LoadingAnimation size="lg" text="Cargando balances" />
          </div>
        )}
      </div>
      <div className="grid w-full grid-cols-1 gap-8">
        {selectedCurrency ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Balance de Caja</CardTitle>
              <Tabs
                value={balanceChartDays}
                onValueChange={setBalanceChartDays}
                defaultValue="30"
                className="w-min"
              >
                <TabsList>
                  <TabsTrigger value="30">30d</TabsTrigger>
                  <TabsTrigger value="45">45d</TabsTrigger>
                  <TabsTrigger value="90">90d</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={balanceChart
                    .find((b) => b.currency === selectedCurrency)!
                    .balances.map((b) => ({
                      name: moment(b.date).format("DD-MM"),
                      value: b.balance,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis
                    tickFormatter={(number: number) =>
                      formatNumberLabel(number)
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    isAnimationActive={true}
                  />
                  <Bar
                    dataKey="value"
                    fill={
                      currencies.find((c) => c.value === selectedCurrency)!
                        .color
                    }
                  />
                </BarChart>
              </ResponsiveContainer>
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
      <div className="flex">
        {selectedCurrency ? (
          <Card className="w-full">
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
                  data={movements.movements.map((row) => {
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
