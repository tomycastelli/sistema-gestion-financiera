"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { type Session } from "next-auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  generateTableData,
  getAllChildrenTags,
  isNumeric,
} from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currencies } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import LoadingAnimation from "../components/LoadingAnimation";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "../components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Label } from "../components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
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
  tags: RouterOutputs["tags"]["getAll"];
  entities: RouterOutputs["entities"]["getAll"];
  entityId: number | null;
  entityTag: string | null;
  pageSize: number;
  session: Session | null;
  accountType: boolean;
  linkId: number | null;
  linkToken: string | null;
}

const MovementsTable = ({
  initialMovements,
  tags,
  entities,
  entityId,
  entityTag,
  pageSize,
  session,
  accountType,
  linkId,
  linkToken,
}: CuentasTableProps) => {
  const searchParams = useSearchParams();
  const selectedEntityString = searchParams.get("entidad");

  const [selectedFromEntity, setSelectedFromEntity] = useState<string>();

  const {
    movementsTablePage,
    setMovementsTablePage,
    destinationEntityId,
    setDestinationEntityId,
    selectedCurrency,
    setSelectedCurrency,
  } = useCuentasStore();

  const { data, refetch, isFetching } =
    api.movements.getCurrentAccounts.useQuery(
      {
        linkId: linkId,
        linkToken: linkToken,
        account: accountType,
        entityId: selectedFromEntity ? parseInt(selectedFromEntity) : entityId,
        entityTag: selectedFromEntity ? undefined : entityTag,
        toEntityId: destinationEntityId,
        currency: selectedCurrency,
        pageNumber: movementsTablePage,
        pageSize: pageSize,
      },
      {
        initialData: initialMovements,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
      },
    );

  const tableData = generateTableData(
    data.movements,
    entityId,
    entityTag,
    tags,
  );

  const columns: ColumnDef<(typeof tableData)[number]>[] = [
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
      header: "Detalle",
      cell: ({ row }) => {
        let type = "";
        if (row.getValue("type") === "upload") {
          type = "Carga";
        } else if (row.getValue("type") === "confirmation") {
          type = "Confirmación";
        } else if (row.getValue("type") === "cancellation") {
          type = "Cancelación";
        } else {
          type = row.getValue("type");
        }
        const metadata: JSON = row.getValue("metadata");
        const mvId: number = row.getValue("id");
        const txType: string = row.getValue("txType");
        const observations: string = row.getValue("observations");

        return (
          <>
            <p className="font-medium">{`${type} de ${txType} - Mto ${mvId} ${
              // @ts-ignore
              metadata && isNumeric(metadata.exchangeRate)
                ? // @ts-ignore
                  `- $${metadata.exchangeRate}`
                : ""
            }`}</p>
            <p className="text-sm font-light text-muted-foreground">
              {observations}
            </p>
          </>
        );
      },
    },
    {
      accessorKey: "txType",
      header: "Transaction type",
    },
    {
      accessorKey: "observations",
      header: "Observaciones",
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
    <div>
      <div>
        <div className="flex flex-row items-end justify-start space-x-4 py-4">
          {entityTag && (
            <div className="flex flex-col">
              <Label className="mb-2">Origen</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-[200px] justify-between",
                      !selectedFromEntity && "text-muted-foreground",
                    )}
                  >
                    {selectedFromEntity
                      ? entities.find(
                          (e) => e.id === parseInt(selectedFromEntity),
                        )?.name
                      : "Elegir"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Elegir..." />
                    <CommandEmpty>...</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="todas"
                        onSelect={() => setSelectedFromEntity(undefined)}
                      >
                        Todas
                      </CommandItem>
                      {entities
                        .filter(
                          (e) =>
                            getAllChildrenTags(entityTag, tags).includes(
                              e.tag.name,
                            ) || e.id === entityId,
                        )
                        .map((entity) => (
                          <CommandItem
                            key={entity.id}
                            value={entity.name}
                            onSelect={() =>
                              setSelectedFromEntity(entity.id.toString())
                            }
                          >
                            {entity.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
          <div className="flex flex-col space-y-1">
            <Label className="mb-1">Divisa</Label>
            <Select
              value={selectedCurrency ? selectedCurrency : "todas"}
              onValueChange={(value) =>
                value === "todas"
                  ? setSelectedCurrency(undefined)
                  : setSelectedCurrency(value)
              }
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-[200px] justify-between",
                    !destinationEntityId && "text-muted-foreground",
                  )}
                >
                  {destinationEntityId
                    ? entities.find((e) => e.id === destinationEntityId)?.name
                    : "Elegir"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Elegir..." />
                  <CommandEmpty>...</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="todas"
                      onSelect={() => setDestinationEntityId(undefined)}
                    >
                      Todas
                    </CommandItem>
                    {entities
                      .filter(
                        (e) => e.id !== entityId && e.tag.name !== entityTag,
                      )
                      .map((entity) => (
                        <CommandItem
                          key={entity.id}
                          value={entity.name}
                          onSelect={() => setDestinationEntityId(entity.id)}
                        >
                          {entity.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {session && selectedEntityString && !accountType && (
            <ClientLinkGenerator selectedEntityString={selectedEntityString} />
          )}
          <Button variant="outline" onClick={() => refetch()}>
            <Icons.reload className="h-5" />
          </Button>
        </div>
        {!isFetching ? (
          <DataTable columns={columns} data={tableData} />
        ) : (
          <LoadingAnimation text="Cargando movimientos" />
        )}
      </div>
      <div className="mt-2 flex flex-row items-center justify-between text-lg text-muted-foreground">
        <div className="flex flex-row items-center space-x-3">
          {movementsTablePage > 1 && (
            <Button
              variant="outline"
              className="flex flex-row items-center space-x-1"
              onClick={() => setMovementsTablePage(movementsTablePage - 1)}
            >
              <Icons.chevronLeft className="h-6" />
              <p>Anterior</p>
            </Button>
          )}
          <p>
            <span className="text-black">{movementsTablePage}</span>
            {" / " + Math.ceil(data.totalRows / pageSize)}
          </p>
          {movementsTablePage < Math.ceil(data.totalRows / pageSize) && (
            <Button
              variant="outline"
              className="flex flex-row items-center space-x-1"
              onClick={() => setMovementsTablePage(movementsTablePage + 1)}
            >
              <p>Siguiente</p>
              <Icons.chevronRight className="h-6" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovementsTable;
