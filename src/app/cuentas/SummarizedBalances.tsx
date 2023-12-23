"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { type FC } from "react";
import {
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { generateTableData } from "~/lib/functions";
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
  initialMovements: RouterOutputs["movements"]["getMovementsByCurrency"];
  movementsAmount: number;
  selectedTag: string | null;
  selectedEntityId: number | null;
  tags: RouterOutputs["tags"]["getAll"];
}

const SummarizedBalances: FC<SummarizedBalancesProps> = ({
  initialBalancesForCard,
  initialBalancesForCardInput,
  initialMovements,
  movementsAmount,
  selectedTag,
  selectedEntityId,
  tags,
}) => {
  const { data: balancesForCard } =
    api.movements.getBalancesByEntitiesForCard.useQuery(
      initialBalancesForCardInput,
      {
        initialData: initialBalancesForCard,
        refetchOnWindowFocus: false,
      },
    );

  const { selectedTimeframe, selectedCurrency, setSelectedCurrency } =
    useCuentasStore();

  const { data: balancesHistory } = api.movements.getBalancesHistory.useQuery({
    currency: selectedCurrency,
    timeRange: selectedTimeframe,
    entityId: selectedEntityId,
    entityTag: selectedTag,
  });

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

  const tableData = generateTableData(
    movements,
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
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem>
                <Link
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

  return (
    <div className="grid grid-cols-4 gap-8">
      <div className="col-span-4 grid grid-cols-3 gap-8">
        {balancesForCard &&
          balancesForCard.map((item) => (
            <Card
              key={item.currency}
              onClick={() => setSelectedCurrency(item.currency)}
              className="transition-all hover:shadow-lg"
            >
              <CardHeader>
                <CardTitle>{item.currency.toUpperCase()}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  {item.balances.map((balance) => (
                    <div
                      key={balance.amount}
                      className="flex flex-col space-y-2"
                    >
                      <p>{balance.account ? "Caja" : "Cuenta corriente"}</p>
                      <p className="text-xl font-semibold">{balance.amount}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
      <div className="col-span-4 grid grid-cols-2 gap-8">
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
                  <BarChart data={balancesHistory}>
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
              ) : movements.length > 0 ? (
                <DataTable columns={columns} data={tableData} />
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
