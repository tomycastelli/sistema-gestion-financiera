"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { type Session } from "next-auth";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createQueryString, removeQueryString } from "~/lib/functions";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import { Icons } from "../components/ui/Icons";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import ClientLinkGenerator from "./ClientLinkGenerator";
import { DataTable } from "./DataTable";

interface CuentasTableProps {
  initialMovements: RouterOutputs["movements"]["getCurrentAccounts"];
  entityId?: number;
  entityTag?: string;
  account: RouterInputs["movements"]["getCurrentAccounts"]["account"];
  pageSize: number;
  pageNumber: number;
  session: Session | null;
  accountType: boolean;
}

const MovementsTable = ({
  initialMovements,
  entityId,
  account,
  entityTag,
  pageSize,
  pageNumber,
  session,
  accountType,
}: CuentasTableProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCurrency = searchParams.get("divisa");
  const selectedToEntity = searchParams.get("entidad_destino");
  const selectedEntityString = searchParams.get("entidad");

  const selectedPageNumber = parseInt(searchParams.get("pagina")!) || 1;

  const { data, isLoading } = api.movements.getCurrentAccounts.useQuery(
    {
      account: account,
      entityId: entityId,
      entityTag: entityTag,
      pageNumber: pageNumber,
      pageSize: pageSize,
    },
    {
      initialData: initialMovements,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  );

  const tableData = data.movements.map((movement) => {
    let otherEntity = { id: 0, name: "", tag: "" };
    let selectedEntity = { id: 0, name: "", tag: "" };

    if (entityId) {
      otherEntity =
        entityId !== movement.transaction.fromEntity.id
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;

      selectedEntity =
        entityId === movement.transaction.fromEntity.id
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;
    } else if (entityTag) {
      otherEntity =
        movement.transaction.fromEntity.tag !== entityTag
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;

      selectedEntity =
        movement.transaction.fromEntity.tag === entityTag
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;
    }

    let ingress = 0;
    let egress = 0;

    if (entityId) {
      ingress =
        (entityId === movement.transaction.toEntity.id &&
          movement.direction === 1) ||
        (entityId === movement.transaction.fromEntity.id &&
          movement.direction === -1)
          ? movement.transaction.amount
          : 0;

      egress =
        (entityId === movement.transaction.toEntity.id &&
          movement.direction === -1) ||
        (entityId === movement.transaction.fromEntity.id &&
          movement.direction === 1)
          ? movement.transaction.amount
          : 0;
    } else if (entityTag) {
      ingress =
        (movement.transaction.toEntity.tag === entityTag &&
          movement.direction === 1) ||
        (movement.transaction.fromEntity.tag === entityTag &&
          movement.direction === -1)
          ? movement.transaction.amount
          : 0;

      egress =
        (movement.transaction.toEntity.tag === entityTag &&
          movement.direction === -1) ||
        (movement.transaction.fromEntity.tag === entityTag &&
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

  const balanceTracker: Record<string, Record<string, number>> = {};

  const updatedTableData = tableData
    .reverse()
    .map((movement) => {
      const currency = movement.currency;
      const otherEntity = movement.otherEntity;

      if (!balanceTracker[currency]) {
        balanceTracker[currency] = {};
      }

      // @ts-ignore
      if (!balanceTracker[currency][otherEntity]) {
        // @ts-ignore
        balanceTracker[currency][otherEntity] = 0;
      }

      // @ts-ignore
      const currentBalance = balanceTracker[currency][otherEntity] ?? 0;

      let balance;

      if (movement.ingress > 0) {
        balance = currentBalance + movement.ingress;
      } else {
        balance = currentBalance - movement.egress;
      }

      // @ts-ignore
      balanceTracker[currency][otherEntity] = balance;

      return {
        ...movement,
        balance: balance,
      };
    })
    .reverse();

  const toEntities = Array.from(
    new Set(updatedTableData.map((item) => item.otherEntityId)),
  ).map((uniqueId) => {
    const matchingObject = updatedTableData.find(
      (item) => item.otherEntityId === uniqueId,
    );
    if (matchingObject) {
      return {
        otherEntityId: matchingObject.otherEntityId,
        otherEntity: matchingObject.otherEntity,
      };
    }
  });

  const currencies = Array.from(
    new Set(updatedTableData.map((item) => item.currency)),
  ).map((uniqueCurrency) => {
    const matchingObject = updatedTableData.find(
      (item) => item.currency === uniqueCurrency,
    );
    if (matchingObject) {
      return {
        value: matchingObject.currency,
        label: matchingObject.currency.toUpperCase(),
      };
    }
  });

  const columns: ColumnDef<(typeof updatedTableData)[number]>[] = [
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
              {updatedTableData[row.index]!.currency.toUpperCase()}
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
              {updatedTableData[row.index]!.currency.toUpperCase()}
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
              {updatedTableData[row.index]!.currency.toUpperCase()}
            </span>{" "}
            {formatted}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {isLoading ? (
        <p>Cargando movimientos</p>
      ) : (
        <div>
          <div className="flex flex-row items-end justify-start space-x-4 py-4">
            <div className="flex flex-col space-y-1">
              <Label className="mb-1">Divisa</Label>
              <Select
                value={selectedCurrency ? selectedCurrency : "todas"}
                onValueChange={(value) => {
                  if (value === "todas") {
                    router.push(
                      pathname +
                        "?" +
                        removeQueryString(searchParams, "divisa"),
                    );
                  } else {
                    router.push(
                      pathname +
                        "?" +
                        createQueryString(searchParams, "divisa", value),
                    );
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Divisa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem key={"todas"} value="todas">
                      Todas
                    </SelectItem>
                    {currencies.map((currency) => (
                      <SelectItem
                        key={currency?.value}
                        value={currency?.value ? currency.value : ""}
                      >
                        {currency?.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col">
              <Label className="mb-2">Entidad</Label>
              <Select
                value={selectedToEntity ? selectedToEntity : "todas"}
                onValueChange={(value) => {
                  if (value === "todas") {
                    router.push(
                      pathname +
                        "?" +
                        removeQueryString(searchParams, "entidad_destino"),
                    );
                  } else {
                    router.push(
                      pathname +
                        "?" +
                        createQueryString(
                          searchParams,
                          "entidad_destino",
                          value,
                        ),
                    );
                  }
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Entidad destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem key={"todas"} value="todas">
                      Todas
                    </SelectItem>
                    {toEntities.map((toEntity) => (
                      <SelectItem
                        key={toEntity?.otherEntityId}
                        value={
                          toEntity?.otherEntityId
                            ? toEntity.otherEntityId.toString()
                            : " "
                        }
                      >
                        {toEntity?.otherEntity}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {session && selectedEntityString && !accountType && (
              <ClientLinkGenerator
                selectedEntityString={selectedEntityString}
              />
            )}
          </div>
          <DataTable
            columns={columns}
            data={updatedTableData}
            toEntities={toEntities}
          />
        </div>
      )}
      <div className="mt-2 flex flex-row items-center justify-between text-lg text-muted-foreground">
        <p className="font-light">{initialMovements.totalRows} movimientos</p>
        <div className="flex flex-row items-center space-x-3">
          {selectedPageNumber > 1 && (
            <Link
              className="flex flex-row items-center space-x-1"
              href={
                pathname +
                "?" +
                createQueryString(
                  searchParams,
                  "pagina",
                  (selectedPageNumber - 1).toString(),
                )
              }
            >
              <Icons.chevronLeft className="h-6" />
              <p>Anterior</p>
            </Link>
          )}
          <p>
            {selectedPageNumber +
              " / " +
              Math.ceil(initialMovements.totalRows / pageSize)}
          </p>
          {selectedPageNumber <
            Math.ceil(initialMovements.totalRows / pageSize) && (
            <Link
              className="flex flex-row items-center space-x-1"
              href={
                pathname +
                "?" +
                createQueryString(
                  searchParams,
                  "pagina",
                  (selectedPageNumber + 1).toString(),
                )
              }
            >
              <p>Siguiente</p>
              <Icons.chevronRight className="h-6" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovementsTable;