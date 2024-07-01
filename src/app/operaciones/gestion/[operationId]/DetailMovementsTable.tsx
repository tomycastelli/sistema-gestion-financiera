import { type ColumnDef } from "@tanstack/react-table";
import moment from "moment";
import { useState, type FC } from "react";
import CustomPagination from "~/app/components/CustomPagination";
import { DataTable } from "~/app/cuentas/DataTable";
import { numberFormatter } from "~/lib/functions";
import { mvTypeFormatting } from "~/lib/variables";
import { type RouterOutputs } from "~/trpc/shared";

interface DetailMovementsTableProps {
  operationDate: RouterOutputs["operations"]["getOperations"]["operations"][number]["date"];
  movements: RouterOutputs["movements"]["getMovementsByOpId"];
  operationId: number;
}

const DetailMovementsTable: FC<DetailMovementsTableProps> = ({
  movements,
  operationDate,
}) => {
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;

  const tableData = movements
    .flatMap((movement) => ({
      id: movement.id,
      date: moment(operationDate).format("DD/MM/YYYY HH:mm"),
      transactionId: movement.transactionId,
      cuenta: movement.account ? "Caja" : "Cuenta corriente",
      type: movement.type,
      fromEntityName:
        movement.direction === 1
          ? movement.transaction.fromEntity.name
          : movement.transaction.toEntity.name,
      toEntityName:
        movement.direction === 1
          ? movement.transaction.toEntity.name
          : movement.transaction.fromEntity.name,
      currency: movement.transaction.currency,
      amount: movement.transaction.amount,
    }))
    .sort((a, b) => b.transactionId - a.transactionId)
    .slice((page - 1) * pageSize, page * pageSize);

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
      accessorKey: "transactionId",
      header: "Transacción",
    },
    {
      accessorKey: "fromEntityName",
      header: "Origen",
    },
    {
      accessorKey: "toEntityName",
      header: "Destino",
    },
    {
      accessorKey: "cuenta",
      header: "Cuenta",
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        const rowType = row.getValue("type");
        if (typeof rowType === "string") {
          return <p className="font-medium">{mvTypeFormatting.get(rowType)}</p>;
        }
      },
    },
    {
      accessorKey: "currency",
      header: "Divisa",
      filterFn: "equals",
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Monto</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
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
  ];

  return (
    <div className="flex flex-col justify-start gap-y-2">
      <DataTable columns={columns} data={tableData} />
      <CustomPagination
        page={page}
        changePageState={setPage}
        itemName="movimientos"
        pageSize={pageSize}
        totalCount={movements.length}
      />
    </div>
  );
};

export default DetailMovementsTable;
