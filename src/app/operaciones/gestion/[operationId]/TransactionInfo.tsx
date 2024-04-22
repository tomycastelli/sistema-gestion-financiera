import moment from "moment";
import { type FC } from "react";
import { z } from "zod";
import { Icons } from "~/app/components/ui/Icons";
import { Button } from "~/app/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/app/components/ui/hover-card";
import { numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { type RouterOutputs } from "~/trpc/shared";

interface TransactionInfoProps {
  tx: RouterOutputs["operations"]["getOperations"]["operations"][number]["transactions"][number]
  users: RouterOutputs["users"]["getAll"]
  entities: RouterOutputs["entities"]["getAll"]
  isInFeed: boolean
}

const ChangeData = z.object({
  key: z.string(),
  after: z.union([z.number(), z.string()]),
  before: z.union([z.number(), z.string()]),
});

const ChangeObject = z.object({
  changeData: z.array(ChangeData),
  changeDate: z.string(), // Assuming changeDate is a string, adjust if it has a different type
  changedBy: z.string(),
});

const TransactionInfo: FC<TransactionInfoProps> = ({ tx, users, entities, isInFeed }) => {
  const { selectedTxForMvs, setSelectedTxForMvs } = useOperationsPageStore()

  const onInfoClick = () => {
    if (isInFeed) return
    if (selectedTxForMvs === tx.id) {
      setSelectedTxForMvs(undefined)
    } else {
      setSelectedTxForMvs(tx.id)
    }
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="outline" className="transition-all hover:scale-110 p-0 hover:bg-transparent border-transparent" onClick={() => onInfoClick()}>
          <Icons.info className={cn("h-8", selectedTxForMvs === tx.id && "text-primary")} />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="items-center flex flex-col space-y-1 px-4">
        {!isInFeed && (
          <p className="text-sm w-full text-center">Clickeá para resaltar los movimientos relacionados a la transacción</p>
        )}
        {
          // @ts-ignore
          tx.transactionMetadata?.metadata &&
          // @ts-ignore
          tx.transactionMetadata.metadata.exchangeRate && (
            <p className="rounded-xl border border-muted-foreground p-2 shadow-md">
              Cambio:{" "}
              <span className="font-semibold">
                {// @ts-ignore
                  tx.transactionMetadata?.metadata.exchangeRate.toString()}
              </span>
            </p>
          )
        }
        <div className="flex flex-col rounded-xl border border-muted-foreground p-2 shadow-md">
          <p className="font-semibold">
            {moment(tx.transactionMetadata?.uploadedDate).format(
              "DD-MM-YYYY HH:mm:ss",
            )}
          </p>
          <p>
            Cargado por:{" "}
            <span className="font-semibold">
              {tx.transactionMetadata?.uploadedByUser.name}
            </span>{" "}
          </p>
        </div>
        {tx.transactionMetadata?.confirmedByUser && (
          <div className="flex flex-col rounded-xl border border-muted-foreground p-2 shadow-md">
            <p className="font-semibold">
              {moment(tx.transactionMetadata.confirmedDate).format(
                "DD-MM-YYYY HH:mm:ss",
              )}
            </p>
            <p>
              Confirmado por:{" "}
              <span className="font-semibold">
                {tx.transactionMetadata?.confirmedByUser?.name}
              </span>{" "}
            </p>
          </div>
        )}
        {tx.transactionMetadata?.cancelledByUser?.name && (
          <div className="flex flex-col rounded-xl border border-muted-foreground p-2 shadow-md">
            <p className="font-semibold">
              {moment(tx.transactionMetadata.cancelledDate).format(
                "DD-MM-YYYY HH:mm:ss",
              )}
            </p>
            <p>
              Cancelado por:{" "}
              <span className="font-semibold">
                {tx.transactionMetadata?.cancelledByUser.name}
              </span>{" "}
            </p>
          </div>
        )}
        <div className="flex flex-col space-y-2">
          {tx.transactionMetadata?.history && (
            <p className="mb-1 mt-2 font-semibold">Cambios</p>
          )}
          {tx.transactionMetadata?.history &&
            tx.transactionMetadata?.history
              // @ts-ignore
              .sort((a, b) => {
                const dateA = new Date(a.changeDate).getTime();
                const dateB = new Date(b.changeDate).getTime();
                return dateB - dateA;
              })
              .map((item: z.infer<typeof ChangeObject>) => (
                <div
                  key={item.changeDate}
                  className="rounded-xl border border-muted-foreground p-2 shadow-md"
                >
                  <h2 className="text-md font-semibold">
                    {new Date(item.changeDate).toLocaleString("es-AR")}
                  </h2>
                  <h3 className="text-md">
                    {users.find((u) => u.id === item.changedBy)?.name}
                  </h3>
                  <div className="mt-2 flex flex-col space-y-1">
                    {item.changeData.map((change) => (
                      <div key={change.key}>
                        {change.key === "amount" && (
                          <div className="flex flex-row items-center space-x-2">
                            <Icons.money className="h-6" />
                            <p className="font-light">
                              {numberFormatter(
                                // @ts-ignore
                                change.before,
                              )}
                            </p>
                            <Icons.chevronRight className="h-4" />
                            <p className="font-semibold">
                              {numberFormatter(
                                // @ts-ignore
                                change.after,
                              )}
                            </p>
                          </div>
                        )}
                        {change.key === "currency" && (
                          <div className="flex flex-row items-center space-x-2">
                            <Icons.currencyExchange className="h-6" />
                            <p className="font-light">
                              {change.before.toString().toUpperCase()}
                            </p>
                            <Icons.chevronRight className="h-4" />
                            <p className="font-semibold">
                              {change.after.toString().toUpperCase()}
                            </p>
                          </div>
                        )}
                        {[
                          "operatorEntityId",
                          "fromEntityId",
                          "toEntityId",
                        ].includes(change.key) && (
                            <div className="flex flex-row items-center space-x-2">
                              <Icons.person className="h-6" />
                              <p className="font-light">
                                {
                                  entities.find(
                                    (entity) => change.before === entity.id,
                                  )?.name
                                }
                              </p>
                              <Icons.chevronRight className="h-4" />
                              <p className="font-semibold">
                                {
                                  entities.find(
                                    (entity) => change.after === entity.id,
                                  )?.name
                                }
                              </p>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
        </div>
      </HoverCardContent>
    </HoverCard>

  )
}

export default TransactionInfo
