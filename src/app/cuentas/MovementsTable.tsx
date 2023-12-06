"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import moment from "moment";
import { type Session } from "next-auth";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  createQueryString,
  getAllChildrenTags,
  isNumeric,
  removeQueryString,
} from "~/lib/functions";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
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
  pageSize: number;
  pageNumber: number;
  session: Session | null;
  accountType: boolean;
  initialTags: RouterOutputs["tags"]["getAll"];
  linkId: number | null;
  linkToken: string | null;
}

const MovementsTable = ({
  initialMovements,
  entityId,
  entityTag,
  pageSize,
  pageNumber,
  session,
  accountType,
  initialTags,
  linkId,
  linkToken,
}: CuentasTableProps) => {
  const { data: tags } = api.tags.getAll.useQuery(undefined, {
    initialData: initialTags,
    refetchOnWindowFocus: false,
  });

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCurrency = searchParams.get("divisa");
  const selectedToEntity = searchParams.get("entidad_destino");
  const selectedEntityString = searchParams.get("entidad");

  const [selectedFromEntity, setSelectedFromEntity] = useState("");

  const selectedPageNumber = parseInt(searchParams.get("pagina")!) || 1;

  const { data, isLoading } = api.movements.getCurrentAccounts.useQuery(
    {
      linkId: linkId,
      linkToken: linkToken,
      account: accountType,
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
    let otherEntity = { id: 0, name: "", tagName: "" };
    let selectedEntity = { id: 0, name: "", tagName: "" };
    let ingress = 0;
    let egress = 0;

    if (entityId) {
      otherEntity =
        entityId !== movement.transaction.fromEntity.id
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;

      selectedEntity =
        entityId === movement.transaction.fromEntity.id
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;

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
      const tagAndAllChildren = getAllChildrenTags(entityTag, tags);

      otherEntity = !tagAndAllChildren.includes(
        movement.transaction.fromEntity.tagName,
      )
        ? movement.transaction.fromEntity
        : movement.transaction.toEntity;

      selectedEntity = tagAndAllChildren.includes(
        movement.transaction.fromEntity.tagName,
      )
        ? movement.transaction.fromEntity
        : movement.transaction.toEntity;

      ingress =
        (tagAndAllChildren.includes(movement.transaction.toEntity.tagName) &&
          movement.direction === 1) ||
          (tagAndAllChildren.includes(movement.transaction.fromEntity.tagName) &&
            movement.direction === -1)
          ? movement.transaction.amount
          : 0;

      egress =
        (tagAndAllChildren.includes(movement.transaction.toEntity.tagName) &&
          movement.direction === -1) ||
          (tagAndAllChildren.includes(movement.transaction.fromEntity.tagName) &&
            movement.direction === 1)
          ? movement.transaction.amount
          : 0;
    }

    return {
      id: movement.id,
      date: movement.transaction.date
        ? moment(movement.transaction.date).format("DD/MM/YYYY")
        : moment(movement.transaction.operation.date).format("DD/MM/YYYY"),
      operationId: movement.transaction.operationId,
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
      metadata: movement.transaction.transactionMetadata?.metadata,
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

  const fromEntities = Array.from(
    new Set(updatedTableData.map((item) => item.selectedEntityId)),
  ).map((uniqueId) => {
    const matchingObject = updatedTableData.find(
      (item) => item.selectedEntityId === uniqueId,
    );
    if (matchingObject) {
      return {
        selectedEntityId: matchingObject.selectedEntityId,
        selectedEntity: matchingObject.selectedEntity,
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
      accessorKey: "date",
      header: "Fecha",
    },
    {
      accessorKey: "selectedEntity",
      header: "Origen",
    },
    {
      accessorKey: "selectedEntityId",
      header: "Origen ID",
      filterFn: "equals",
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
        const metadata: JSON = row.getValue("metadata");
        const mvId: number = row.getValue("id");
        const txType: string = row.getValue("txType");

        return (
          <p className="font-medium">{`${type} de ${txType} - Mto ${mvId} ${
            // @ts-ignore
            metadata && isNumeric(metadata.exchangeRate)
              ? // @ts-ignore
              `- $${metadata.exchangeRate}`
              : ""
            }`}</p>
        );
      },
    },
    {
      accessorKey: "txType",
      header: "Transaction type",
    },
    {
      accessorKey: "metadata",
      header: "Metadata",
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
    <div>
      {isLoading ? (
        <p>Cargando movimientos</p>
      ) : (
        <div>
          <div className="flex flex-row items-end justify-start space-x-4 py-4">
            <div className="flex flex-col">
              <Label className="mb-2">Origen</Label>
              <Select
                value={selectedFromEntity ? selectedFromEntity : "todas"}
                onValueChange={(value) =>
                  value !== "todas"
                    ? setSelectedFromEntity(value)
                    : setSelectedFromEntity("")
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Entidad origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem key={"todas"} value="todas">
                      Todas
                    </SelectItem>
                    {fromEntities.map((fromEntity) => (
                      <SelectItem
                        key={fromEntity?.selectedEntityId}
                        value={
                          fromEntity?.selectedEntityId
                            ? fromEntity.selectedEntityId.toString()
                            : " "
                        }
                      >
                        {fromEntity?.selectedEntity}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
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
                      { scroll: false },
                    );
                  } else {
                    router.push(
                      pathname +
                      "?" +
                      createQueryString(searchParams, "divisa", value),
                      { scroll: false },
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
                      { scroll: false },
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
            selectedFromEntity={selectedFromEntity}
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
              scroll={false}
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
