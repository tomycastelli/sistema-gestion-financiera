"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useEffect, type FC } from "react";
import { generateTableData, numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currenciesOrder, mvTypeFormatting } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { DataTable } from "./DataTable";
import LoadingAnimation from "../components/LoadingAnimation";
import OperationDrawer from "../components/OperationDrawer";
import { type User } from "lucia";

interface SummarizedBalancesProps {
  initialBalancesForCard: RouterOutputs["movements"]["getBalancesByEntitiesForCard"];
  initialBalancesInput: RouterInputs["movements"]["getBalancesByEntitiesForCard"];
  initialMovements: RouterOutputs["movements"]["getCurrentAccounts"];
  selectedTag: string | undefined;
  selectedEntity: RouterOutputs["entities"]["getAll"][number] | undefined
  tags: RouterOutputs["tags"]["getAll"];
  uiColor: string | undefined;
  dayInPast: string | undefined
  mainTags: string[]
  entities: RouterOutputs["entities"]["getAll"];
  user: User | null;
  users: RouterOutputs["users"]["getAll"]
  accountingPeriodDate: Date
}

const SummarizedBalances: FC<SummarizedBalancesProps> = ({
  initialBalancesForCard,
  initialBalancesInput,
  initialMovements,
  selectedTag,
  selectedEntity,
  tags,
  uiColor,
  dayInPast,
  mainTags,
  entities,
  user,
  users,
  accountingPeriodDate
}) => {
  const {
    selectedCurrency,
    setSelectedCurrency,
    isInverted,
    setIsInverted,
  } = useCuentasStore();

  useEffect(() => {
    if (selectedTag) {
      if (mainTags.includes(selectedTag)) {
        setIsInverted(false)
      } else {
        setIsInverted(true)
      }
    } else if (selectedEntity) {
      if (mainTags.includes(selectedEntity.tag.name)) {
        setIsInverted(false)
      } else {
        setIsInverted(true)
      }
    }
  }, [mainTags, selectedEntity, selectedTag, setIsInverted])

  const { data: balances, isFetching } = api.movements.getBalancesByEntitiesForCard.useQuery(initialBalancesInput, {
    initialData: initialBalancesForCard,
    refetchOnWindowFocus: false
  })

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

  const tableData = generateTableData(
    movements.movements,
    selectedEntity?.id,
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
        const rowType = row.getValue("type")
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
        const formatted = numberFormatter(amount);
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
        const formatted = numberFormatter(amount);
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

        if (user) return (
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
                mainTags={mainTags} users={users}>
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
        {!isFetching ? balances.sort(
          (a, b) =>
            currenciesOrder.indexOf(a.currency) -
            currenciesOrder.indexOf(b.currency),
        )
          .map((item) => (
            <Card
              key={item.currency}
              onClick={() => setSelectedCurrency(item.currency)}
              style={{ borderColor: item.currency === selectedCurrency ? uiColor : undefined }}
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
                        <p className="text-xl font-semibold">
                          {numberFormatter(
                            balance.amount === 0 ? 0 : !isInverted ? balance.amount : -balance.amount,
                          )}
                        </p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )) : (
          <div className="flex justify-center items-cente lg:col-span-3 col-span-2">
            <LoadingAnimation size="lg" text="Cargando balances" />
          </div>
        )}
      </div>
      <div className="flex mx-auto">
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
