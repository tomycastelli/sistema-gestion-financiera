import { type ColumnDef } from "@tanstack/react-table";
import moment from "moment";
import { type FC } from "react";
import LoadingAnimation from "~/app/components/LoadingAnimation";
import { DataTable } from "~/app/cuentas/DataTable";
import { mvTypeFormatting } from "~/lib/variables";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

interface DetailMovementsTableProps {
  operationDate: RouterOutputs["operations"]["getOperations"]["operations"][number]["date"];
  initialMovements: RouterOutputs["movements"]["getMovementsByOpId"];
  operationId: number
}

const DetailMovementsTable: FC<DetailMovementsTableProps> = ({
  initialMovements,
  operationDate,
  operationId
}) => {
  const { data: movements, isFetching } = api.movements.getMovementsByOpId.useQuery({ operationId }, {
    initialData: initialMovements,
    refetchOnWindowFocus: false
  })
  const tableData = movements.flatMap((movement) => ({
    id: movement.id,
    date: moment(operationDate).format("DD/MM/YYYY HH:mm:ss"),
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
        const rowType = row.getValue("type")
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
    !isFetching ? (
      <DataTable
        columns={columns}
        data={tableData}
      />
    ) : (
      <LoadingAnimation text="Cargando movimientos" />
    )
  );
};

export default DetailMovementsTable;
