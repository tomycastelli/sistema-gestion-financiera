"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import moment from "moment";
import { useMemo, useState, type FC } from "react";
import { toast } from "sonner";
import LoadingAnimation from "~/app/components/LoadingAnimation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/app/components/ui/table";
import { numberFormatter } from "~/lib/functions";
import { currenciesOrder } from "~/lib/variables";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { DateRangePicker } from "../components/DateRangePicker";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Icons } from "../components/ui/Icons";
import { Label } from "../components/ui/label";

interface ExchangesListProps {
  filterCurrency: string | undefined;
  initialExchangeRates: RouterOutputs["exchangeRates"]["getAllExchangeRates"];
}

type GroupedExchangeRate = {
  date: Date;
  [key: string]: Date | number | null;
};

const ExchangesList: FC<ExchangesListProps> = ({
  filterCurrency,
  initialExchangeRates,
}) => {
  const [page, setPage] = useState<number>(1);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  const { data, isLoading } = api.exchangeRates.getAllExchangeRates.useQuery(
    {
      page,
      currency: filterCurrency,
      fromDate,
      toDate,
    },
    {
      initialData: initialExchangeRates,
      refetchOnWindowFocus: false,
    },
  );

  const { mutateAsync: getUrlAsync, isLoading: isDownloading } =
    api.files.getExchangeRates.useMutation({
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

  // Transform the data to group by date
  const groupedData: GroupedExchangeRate[] = useMemo(() => {
    const grouped = data.reduce(
      (acc: Record<string, GroupedExchangeRate>, curr) => {
        const dateKey = moment(curr.date).format("YYYY-MM-DD");
        if (!acc[dateKey]) {
          acc[dateKey] = {
            date: curr.date,
            ...Object.fromEntries(currenciesOrder.map((c) => [c, null])),
          };
        }
        acc[dateKey]![curr.currency.toLowerCase()] = curr.rate;
        return acc;
      },
      {},
    );

    return Object.values(grouped);
  }, [data]);

  const columns: ColumnDef<GroupedExchangeRate>[] = [
    {
      accessorFn: ({ date }) => moment(date).format("DD-MM-YYYY"),
      header: "Fecha",
    },
    ...currenciesOrder
      .filter((c) => c !== "usd")
      .map(
        (currency): ColumnDef<GroupedExchangeRate> => ({
          accessorFn: (row) =>
            row[currency] ? numberFormatter(row[currency] as number, 4) : "-",
          header: currency.toUpperCase(),
        }),
      ),
  ];

  const table = useReactTable({
    data: groupedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const onDownloadClick = (fileType: "pdf" | "csv") => {
    const promise = getUrlAsync({
      fileType,
      fromDate,
      toDate,
    });
    toast.promise(promise, {
      loading: "Generando archivo...",
      success(data) {
        return `Archivo generado: ${data.filename}`;
      },
    });
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-end gap-4 py-4">
        <div className="flex flex-col">
          <Label className="mb-2">Fecha</Label>
          <DateRangePicker
            date={{ from: fromDate, to: toDate }}
            setDate={(d) => {
              setPage(1);
              setFromDate(d?.from);
              setToDate(d?.to);
            }}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {!isDownloading ? (
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
              <DropdownMenuItem onClick={() => onDownloadClick("csv")}>
                <Icons.excel className="h-4" />
                <span>Excel</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div>
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <LoadingAnimation text="Cargando tipos de cambio" size="md" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No hay cotizaciones.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default ExchangesList;
