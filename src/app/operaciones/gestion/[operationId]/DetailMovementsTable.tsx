import { type ColumnDef } from "@tanstack/react-table";
import moment from "moment";
import { type FC } from "react";
import { DataTable } from "~/app/cuentas/DataTable";
import { type RouterOutputs } from "~/trpc/shared";

interface DetailMovementsTableProps {
  operationDate: RouterOutputs["operations"]["getOperations"]["operations"][number]["date"];
  movements: RouterOutputs["movements"]["getMovementsByOpId"];
}

const DetailMovementsTable: FC<DetailMovementsTableProps> = ({
  movements,
  operationDate,
}) => {
  const tableData = movements.flatMap((movement) => ({
    id: movement.id,
    date: movement.transaction.date
      ? moment(movement.transaction.date).format("DD/MM/YYYY HH:mm:ss")
      : moment(operationDate).format("DD/MM/YYYY HH:mm:ss"),
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
  }));

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

  return (
    <DataTable
      columns={columns}
      data={tableData.sort((a, b) => {
        const dateA = moment(a.date, "DD-MM-YYYY HH:mm:ss").valueOf();
        const dateB = moment(b.date, "DD-MM-YYYY HH:mm:ss").valueOf();

        if (dateA === dateB) {
          return b.transactionId - a.transactionId;
        }

        return dateB - dateA;
      })}
    />
  );
};

export default DetailMovementsTable;
