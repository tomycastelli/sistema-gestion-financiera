"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table";

import { useSearchParams } from "next/navigation";
import React, { useEffect } from "react";
import { cn } from "~/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  selectedFromEntity?: string;
}

export function DataTable<TData, TValue>({
  columns,
  selectedFromEntity,
  data,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  const searchParams = useSearchParams();
  const selectedCurrency = searchParams.get("divisa");
  const selectedToEntity = searchParams.get("entidad_destino");
  const higlightRowId = searchParams.get("row")
    ? parseInt(searchParams.get("row")!)
    : null;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      columnFilters: [
        { id: "currency", value: selectedCurrency },
        { id: "otherEntityId", value: selectedToEntity },
        { id: "selectedEntityId", value: selectedFromEntity },
      ],
    },
    state: {
      columnFilters,
      columnVisibility: {
        currency: false,
        otherEntityId: false,
      },
    },
  });

  useEffect(() => {
    if (selectedCurrency) {
      table.getColumn("currency")?.setFilterValue(selectedCurrency);
    } else {
      table.getColumn("currency")?.setFilterValue(undefined);
    }

    if (selectedFromEntity) {
      table
        .getColumn("selectedEntityId")
        ?.setFilterValue(parseInt(selectedFromEntity));
    } else {
      table.getColumn("selectedEntityId")?.setFilterValue(undefined);
    }

    if (selectedToEntity) {
      table
        .getColumn("otherEntityId")
        ?.setFilterValue(parseInt(selectedToEntity));
    } else {
      table.getColumn("otherEntityId")?.setFilterValue(undefined);
    }
  }, [selectedCurrency, table, selectedToEntity, selectedFromEntity]);

  return (
    <div>
      <div className="rounded-md border">
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
                  className={cn(
                    row.getValue("id") === higlightRowId
                      ? "bg-blue-100 hover:bg-blue-200"
                      : "",
                  )}
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
