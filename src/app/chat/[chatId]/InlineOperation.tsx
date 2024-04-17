import moment from "moment";
import Link from "next/link";
import LoadingAnimation from "~/app/components/LoadingAnimation";
import EntityCard from "~/app/components/ui/EntityCard";
import { Icons } from "~/app/components/ui/Icons";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/app/components/ui/card";
import { numberFormatter } from "~/lib/functions";
import { api } from "~/trpc/react";

interface InlineOperationProps {
  operationId: number
}

const InlineOperation = ({ operationId }: InlineOperationProps) => {
  const { data, isLoading, isSuccess } = api.operations.getOperations.useQuery({
    operationId: operationId,
    limit: 1,
    page: 1,
  }, {
    refetchOnWindowFocus: false,
    staleTime: 120000
  });

  const operation = data?.operations[0]

  return (
    !isLoading ? (
      isSuccess ? (
        !!operation ? (
          !!operation.isVisualizeAllowed ? (
            <Card className="w-[500px]">
              <CardHeader>
                <CardTitle>
                  <Link
                    prefetch={false}
                    className=
                    "flex transition-all hover:scale-105 text-xl"
                    href={`/operaciones/gestion/${operation.id}`}
                  >
                    Operación {operation.id}
                  </Link>
                </CardTitle>
                <CardDescription className="text-lg">
                  {moment(operation.date).format("DD-MM-YYYY HH:mm:ss")}
                </CardDescription>
                <CardDescription className="text-md">
                  {operation.observations}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-y-2">
                {operation.transactions.slice(0, 2).map(tx => (
                  <div key={tx.id} className="w-full grid grid-cols-5">
                    <div className="col-span-2">
                      <EntityCard entity={tx.fromEntity} />
                    </div>
                    <div className="col-span-1 flex flex-col gap-y-1">
                      <p className="text-muted-foreground">
                        {tx.currency.toUpperCase()}{" "}
                      </p>
                      <p>
                        {numberFormatter(tx.amount)}
                      </p>
                      <Icons.arrowRight className="w-8" />
                    </div>
                    <div className="col-span-2">
                      <EntityCard entity={tx.toEntity} />
                    </div>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="flex justify-start text-muted-foreground">
                {operation.transactions.length > 1 ? operation.transactions.length.toString() + " " + "transacciones" : "1 transacción"}
              </CardFooter>
            </Card>
          ) : (
            <Card className="w-[250px]">
              <CardHeader>
                <CardTitle>:(</CardTitle>
                <CardDescription>No tenés permisos para ver la operación</CardDescription>
              </CardHeader>
            </Card>

          )
        ) : (
          <Card className="w-[200px]">
            <CardHeader>
              <CardTitle>:(</CardTitle>
              <CardDescription>No se encontró la operación</CardDescription>
            </CardHeader>
          </Card>
        )
      ) : (
        <Card className="w-[200px]">
          <CardHeader>
            <CardTitle>:(</CardTitle>
            <CardDescription>No se pudo cargar la operación</CardDescription>
          </CardHeader>
        </Card>
      )
    ) : (
      <LoadingAnimation text="Cargando operación" />
    )
  )
}

export default InlineOperation
