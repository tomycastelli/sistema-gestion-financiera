"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import moment from "moment";
import { type FC } from "react";
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
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

interface ExchangesListProps {
  page: number;
  filterCurrency: string | undefined;
  initialExchangeRates: RouterOutputs["exchangeRates"]["getAllExchangeRates"];
}

const ExchangesList: FC<ExchangesListProps> = ({
  page,
  filterCurrency,
  initialExchangeRates,
}) => {
  const { data, isLoading } = api.exchangeRates.getAllExchangeRates.useQuery(
    {
      page,
      currency: filterCurrency,
    },
    {
      initialData: initialExchangeRates,
      refetchOnWindowFocus: false,
    },
  );

  const columns: ColumnDef<(typeof data)[number]>[] = [
    {
      accessorFn: ({ date }) => moment(date).format("DD-MM-YYYY"),
      header: "Fecha",
    },
    {
      accessorFn: ({ currency }) => currency.toUpperCase(),
      header: "Divisa",
    },
    {
      accessorFn: ({ rate }) => numberFormatter(rate, 4),
      header: "Cotización",
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return isLoading ? (
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
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center">
              No hay cotizaciones.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export default ExchangesList;
