"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { type User } from "lucia";
import { MoreHorizontal } from "lucide-react";
import moment from "moment";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isNumeric, numberFormatter, truncateString } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currencies, mvTypeFormatting } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import CustomPagination from "../components/CustomPagination";
import { DateRangePicker } from "../components/DateRangePicker";
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
  DropdownMenuGroup,
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
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { DataTable } from "./DataTable";
const OperationDrawer = dynamic(() => import("../components/OperationDrawer"));

interface CuentasTableProps {
  initialMovements: RouterOutputs["movements"]["getCurrentAccounts"];
  tags: RouterOutputs["tags"]["getAll"];
  entities: RouterOutputs["entities"]["getAll"];
  entityId: number | undefined;
  entityTag: string | undefined;
  pageSize: number;
  user: User | null;
  accountType: boolean;
  linkId: number | null;
  linkToken: string | null;
  mainTags: string[];
  users: RouterOutputs["users"]["getAll"];
  accountingPeriodDate: Date;
}

const MovementsTable = ({
  initialMovements,
  entities,
  entityId,
  entityTag,
  pageSize,
  user,
  accountType,
  linkId,
  linkToken,
  mainTags,
  users,
  accountingPeriodDate,
}: CuentasTableProps) => {
  const utils = api.useContext();

  const searchParams = useSearchParams();

  enum Ordering {
    ASC = "asc",
    DESC = "desc",
  }
  const [dateOrdering, setDateOrdering] = useState<Ordering>(Ordering.DESC);
  const [ignoreSameTag, setIgnoreSameTag] = useState(false);

  const {
    movementsTablePage,
    setMovementsTablePage,
    originEntityId,
    setOriginEntityId,
    destinationEntityId,
    setDestinationEntityId,
    selectedCurrency,
    setSelectedCurrency,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    isInverted,
    groupInTag,
    setGroupInTag,
    dayInPast,
  } = useCuentasStore();

  useEffect(() => {
    const cliente_id = searchParams.get("cliente");
    if (cliente_id) {
      setDestinationEntityId(parseInt(cliente_id));
    } else {
      setDestinationEntityId(undefined);
    }
    const origin_entity_id = searchParams.get("origen");
    if (origin_entity_id) {
      setOriginEntityId(parseInt(origin_entity_id));
    } else {
      setOriginEntityId(undefined);
    }
    if (entityTag) {
      setGroupInTag(true);
    }
    setSelectedCurrency(undefined);
    setFromDate(undefined);
    setToDate(undefined);
    setMovementsTablePage(1);
  }, [
    setOriginEntityId,
    setGroupInTag,
    entityTag,
    setDestinationEntityId,
    setSelectedCurrency,
    setFromDate,
    setToDate,
    setMovementsTablePage,
    searchParams,
  ]);

  useEffect(() => {
    console.log({ dayInPast });
  }, [dayInPast]);

  const { data, refetch, isFetching } =
    api.movements.getCurrentAccounts.useQuery(
      {
        linkId: linkId,
        linkToken: linkToken,
        account: accountType,
        entityId: entityId,
        entityTag: entityTag,
        originEntityId,
        toEntityId: destinationEntityId,
        currency: selectedCurrency,
        fromDate: fromDate,
        toDate: toDate,
        pageNumber: movementsTablePage,
        pageSize: pageSize,
        dayInPast: dayInPast ? dayInPast : undefined,
        groupInTag,
        dateOrdering,
        ignoreSameTag,
      },
      {
        initialData: initialMovements,
        refetchOnWindowFocus: false,
      },
    );

  const { mutateAsync: getUrlAsync, isLoading } =
    api.files.getCurrentAccount.useMutation({
      onSuccess(newOperation) {
        if (newOperation) {
          const link = document.createElement("a");
          link.href = newOperation.downloadUrl;
          link.download = newOperation.filename;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      },
      onError(err) {
        toast.error("Error al generar el archivo", {
          description: err.message,
        });
      },
    });

  const onDownloadClick = (fileType: "pdf" | "xlsx") => {
    if (data.totalRows > 1000) {
      toast.warning("Vas a generar un archivo con mas de 1000 movimientos", {
        action: {
          label: "Generar",
          onClick: () => {
            const promise = getUrlAsync({
              account: accountType,
              entityId: entityId,
              entityTag: entityTag,
              currency: selectedCurrency,
              fromDate: fromDate,
              toDate: toDate,
              fileType,
              dayInPast,
              toEntityId: destinationEntityId,
              dateOrdering,
              ignoreSameTag,
            });

            toast.promise(promise, {
              loading: "Generando archivo...",
              success(data) {
                return `Archivo generado: ${data.filename}`;
              },
            });
          },
        },
      });
    } else {
      const promise = getUrlAsync({
        account: accountType,
        entityId: entityId,
        entityTag: entityTag,
        currency: selectedCurrency,
        fromDate: fromDate,
        toDate: toDate,
        fileType,
        dayInPast,
        toEntityId: destinationEntityId,
        dateOrdering,
        ignoreSameTag,
      });

      toast.promise(promise, {
        loading: "Generando archivo...",
        success(data) {
          return `Archivo generado: ${data.filename}`;
        },
      });
    }
  };

  const columns: ColumnDef<(typeof data.movements)[number]>[] = [
    {
      accessorKey: "id",
      header: "ID",
    },
    {
      accessorKey: "date",
      header: "Fecha",
      accessorFn: (row) => moment(row.date).format("DD-MM-YY"),
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
        const rowType = row.getValue("type");
        const type =
          typeof rowType === "string" ? mvTypeFormatting.get(rowType) : "";

        const metadata: JSON | null = row.getValue("metadata");
        const mvId: number = row.getValue("id");
        const txType: string = row.getValue("txType");
        const observations: string = row.getValue("observations");

        return (
          <>
            <p className="font-semibold">{observations}</p>
            <p className="font-normal">{`${type} de ${txType} - Mto ${mvId} ${
              // @ts-ignore
              metadata && isNumeric(metadata.exchange_rate)
                ? // @ts-ignore
                  `- $${metadata.exchange_rate}`
                : ""
            }`}</p>
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
        const formatted = numberFormatter(amount);
        return amount !== 0 ? (
          <div
            className={cn(
              "text-right font-medium",
              data.movements[row.index]!.transactionStatus === "cancelled"
                ? "line-through"
                : "",
            )}
          >
            {" "}
            <span className="font-light text-muted-foreground">
              {data.movements[row.index]!.currency.toUpperCase()}
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
          <div
            className={cn(
              "text-right font-medium",
              data.movements[row.index]!.transactionStatus === "cancelled"
                ? "line-through"
                : "",
            )}
          >
            {" "}
            <span className="font-light text-muted-foreground">
              {data.movements[row.index]!.currency.toUpperCase()}
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
          <div
            className={cn(
              "text-right font-medium",
              amount !== 0
                ? !isInverted
                  ? amount > 0
                    ? "text-green"
                    : "text-red"
                  : -amount > 0
                  ? "text-green"
                  : "text-red"
                : undefined,
            )}
          >
            {" "}
            <span className="font-light text-muted-foreground">
              {data.movements[row.index]!.currency.toUpperCase()}
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

        if (user)
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Abrir menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <OperationDrawer
                  entities={entities}
                  user={user}
                  opId={movement.operationId}
                  opDate={moment(movement.date, "DD-MM-YYYY HH:mm").toDate()}
                  accountingPeriodDate={accountingPeriodDate}
                  mainTags={mainTags}
                  users={users}
                >
                  <Button variant="outline">
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
    <div>
      <div>
        <div className="flex flex-row flex-wrap items-end justify-start gap-4 py-4">
          <div className="flex flex-col">
            <Label className="mb-1">Divisa</Label>
            <Select
              value={selectedCurrency ?? "todas"}
              onValueChange={(value) => {
                setMovementsTablePage(1);
                if (value === "todas") {
                  setSelectedCurrency(undefined);
                } else {
                  if (value === "usdt") {
                    setGroupInTag(true);
                  }
                  setSelectedCurrency(value);
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
          {entityTag && !entityId && (
            <div className="flex flex-col">
              <Label className="mb-2">Origen</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-[200px] justify-between",
                      !originEntityId && "text-muted-foreground",
                    )}
                  >
                    {originEntityId
                      ? truncateString(
                          entities.find((e) => e.id === originEntityId)?.name,
                          22,
                        )
                      : "Elegir"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Elegir..." />
                    <CommandEmpty>...</CommandEmpty>
                    <ScrollArea className="h-44 w-48 rounded-md">
                      <CommandGroup>
                        <CommandItem
                          value="todas"
                          onSelect={() => {
                            setMovementsTablePage(1);
                            setOriginEntityId(undefined);
                          }}
                        >
                          Todas
                        </CommandItem>
                        {entities
                          .filter(
                            (e) =>
                              e.id === entityId || e.tag.name === entityTag,
                          )
                          .map((entity) => (
                            <CommandItem
                              key={entity.id}
                              value={entity.name}
                              onSelect={() => {
                                setMovementsTablePage(1);
                                setOriginEntityId(entity.id);
                              }}
                            >
                              {entity.name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </ScrollArea>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
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
                    ? truncateString(
                        entities.find((e) => e.id === destinationEntityId)
                          ?.name,
                        22,
                      )
                    : "Elegir"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Elegir..." />
                  <CommandEmpty>...</CommandEmpty>
                  <ScrollArea className="h-44 w-48 rounded-md">
                    <CommandGroup>
                      <CommandItem
                        value="todas"
                        onSelect={() => {
                          setMovementsTablePage(1);
                          setDestinationEntityId(undefined);
                        }}
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
                            onSelect={() => {
                              setMovementsTablePage(1);
                              setDestinationEntityId(entity.id);
                            }}
                          >
                            {entity.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </ScrollArea>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col">
            <Label className="mb-2">Fecha</Label>
            <DateRangePicker
              date={{ from: fromDate, to: toDate }}
              setDate={(d) => {
                setMovementsTablePage(1);
                setFromDate(d?.from);
                setToDate(d?.to);
              }}
            />
          </div>
          <Button
            tooltip="Recargar movimientos"
            variant="outline"
            onClick={async () => {
              await utils.movements.getBalancesByEntities.refetch();
              void refetch();
            }}
          >
            <Icons.reload className="h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {!isLoading ? (
                <Button variant="outline" tooltip="Descargar">
                  <Icons.download className="h-5" />
                </Button>
              ) : (
                <p>Cargando...</p>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Extensión</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onDownloadClick("pdf")}>
                  <Icons.pdf className="h-4" />
                  <span>PDF</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownloadClick("xlsx")}>
                  <Icons.excel className="h-4" />
                  <span>Excel</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {entityTag && (
            <div className="flex flex-col justify-start gap-y-1">
              <Label className="mb-2">Agrupar</Label>
              <Button
                disabled={
                  selectedCurrency === "usdt" && groupInTag && accountType
                }
                variant="outline"
                onClick={() => setGroupInTag(!groupInTag)}
              >
                <Switch checked={groupInTag} />
              </Button>
            </div>
          )}
          {entityTag && (
            <div className="flex flex-col justify-start gap-y-1">
              <Label className="mb-2">
                Ignorar {entityTag}-{entityTag}
              </Label>
              <Button
                variant="outline"
                onClick={() => setIgnoreSameTag(!ignoreSameTag)}
              >
                <Switch checked={ignoreSameTag} />
              </Button>
            </div>
          )}
          <div className="flex flex-col justify-start gap-y-1">
            <Label className="mb-2">Ordenar por fecha</Label>
            <Button
              variant="outline"
              onClick={() => {
                if (dateOrdering === Ordering.DESC) {
                  setDateOrdering(Ordering.ASC);
                } else {
                  setDateOrdering(Ordering.DESC);
                }
              }}
            >
              {dateOrdering === Ordering.DESC ? (
                <div className="flex gap-2">
                  <Icons.calendarArrowDown className="h-5 w-5" />
                  <p>Reciente</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Icons.calendarArrowUp className="h-5 w-5" />
                  <p>Antigua</p>
                </div>
              )}
            </Button>
          </div>
        </div>
        {!isFetching ? (
          <DataTable
            columns={columns}
            data={data.movements.map((row) => {
              if (!isInverted) {
                return row;
              } else {
                return {
                  ...row,
                  selectedEntity: row.otherEntity,
                  selectedEntityId: row.otherEntityId,
                  otherEntity: row.selectedEntity,
                  otherEntityId: row.selectedEntityId,
                  ingress: row.egress,
                  egress: row.ingress,
                  balance: -row.balance,
                };
              }
            })}
          />
        ) : (
          <LoadingAnimation text="Cargando movimientos" />
        )}
      </div>
      <div className="mt-4 flex w-fit flex-col items-center justify-start space-y-2">
        <CustomPagination
          page={movementsTablePage}
          changePageState={setMovementsTablePage}
          itemName="movimientos"
          pageSize={pageSize}
          totalCount={data.totalRows}
        />
      </div>
    </div>
  );
};

export default MovementsTable;
