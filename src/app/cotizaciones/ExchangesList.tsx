"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import moment from "moment";
import { useState, type FC } from "react";
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
import type { GroupedExchangeRate } from "~/server/api/routers/types";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import CustomPagination from "../components/CustomPagination";
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
  initialExchangeRates: RouterOutputs["exchangeRates"]["getAllExchangeRates"];
}

const ExchangesList: FC<ExchangesListProps> = ({ initialExchangeRates }) => {
  const [page, setPage] = useState<number>(1);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  const { data: response, isLoading } =
    api.exchangeRates.getAllExchangeRates.useQuery(
      {
        page,
        fromDate: fromDate ? moment(fromDate).format("YYYY-MM-DD") : undefined,
        toDate: toDate ? moment(toDate).format("YYYY-MM-DD") : undefined,
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

  const columns: ColumnDef<GroupedExchangeRate>[] = [
    {
      accessorFn: ({ date }) =>
        moment.utc(date, "YYYY-MM-DD").format("DD-MM-YYYY"),
      header: "Fecha",
    },
    ...currenciesOrder
      .filter((c) => c !== "usd")
      .map(
        (currency): ColumnDef<GroupedExchangeRate> => ({
          accessorFn: (row) =>
            row[currency.toLowerCase()]
              ? numberFormatter(row[currency.toLowerCase()] as number, 4)
              : "-",
          header: currency.toUpperCase(),
        }),
      ),
  ];

  const groupedData = response.data;

  const table = useReactTable({
    data: groupedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const onDownloadClick = (fileType: "pdf" | "csv") => {
    const promise = getUrlAsync({
      fileType,
      fromDate: fromDate ? moment(fromDate).format("YYYY-MM-DD") : undefined,
      toDate: toDate ? moment(toDate).format("YYYY-MM-DD") : undefined,
    });
    toast.promise(promise, {
      loading: "Generando archivo...",
      success(data) {
        return `Archivo generado: ${data.filename}`;
      },
    });
  };

  console.log({ groupedData });

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
      <div className="flex flex-col gap-y-4">
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
        {response.totalDates > 12 && (
          <CustomPagination
            page={page}
            pageSize={12}
            itemName="cotizaciones"
            totalCount={response.totalDates}
            changePageState={setPage}
          />
        )}
      </div>
    </div>
  );
};

export default ExchangesList;
