import { type ColumnDef } from "@tanstack/react-table";
import moment from "moment";
import { type FC } from "react";
import { DataTable } from "~/app/cuentas/DataTable";
import { type RouterOutputs } from "~/trpc/shared";

interface DetailMovementsTableProps {
  operation: RouterOutputs["operations"]["getOperationDetails"];
}

const DetailMovementsTable: FC<DetailMovementsTableProps> = ({ operation }) => {
  const tableData = operation!.transactions
    .map((transaction) =>
      transaction.movements.map((movement) => ({
        id: movement.id,
        date: transaction.date
          ? moment(transaction.date).format("DD/MM/YYYY")
          : moment(operation!.date).format("DD/MM/YYYY"),
        transactionId: movement.transactionId,
        cuenta: movement.account ? "Caja" : "Cuenta corriente",
        type: movement.type,
        fromEntityName:
          movement.direction === 1
            ? transaction.fromEntity.name
            : transaction.toEntity.name,
        toEntityName:
          movement.direction === 1
            ? transaction.toEntity.name
            : transaction.fromEntity.name,
        currency: transaction.currency,
        amount: transaction.amount,
      })),
    )
    .flat();

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
      accessorKey: "amount",
      header: () => <div className="text-right">Monto</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
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
  ];

  return <DataTable columns={columns} data={tableData} />;
};

export default DetailMovementsTable;
