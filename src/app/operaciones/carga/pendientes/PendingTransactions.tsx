"use client";

import { type FC } from "react";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { capitalizeFirstLetter, numberFormatter } from "~/lib/functions";
import { Icons } from "~/app/components/ui/Icons";
import EntityCard from "~/app/components/ui/EntityCard";
import { cn } from "~/lib/utils";
import { Status } from "~/server/db/schema";
import { Button } from "~/app/components/ui/button";
import { toast } from "sonner";
import { type User } from "lucia";

interface PendingTransactionsProps {
  initialPendingTransactions: RouterOutputs["operations"]["getPendingTransactions"];
  mainTags: string[];
  user: User;
}

const PendingTransactions: FC<PendingTransactionsProps> = ({
  initialPendingTransactions,
  mainTags,
  user,
}) => {
  const { data: pendingTransactions } =
    api.operations.getPendingTransactions.useQuery(undefined, {
      initialData: initialPendingTransactions,
    });

  const utils = api.useContext();

  const { mutateAsync } = api.operations.approvePendingTransactions.useMutation(
    {
      async onMutate(newOperation) {
        // Doing the Optimistic update
        await utils.operations.getPendingTransactions.cancel();

        const prevData = utils.operations.getPendingTransactions.getData();

        utils.operations.getPendingTransactions.setData(undefined, (old) =>
          old!.filter((pendingTx) =>
            newOperation.pendingTransactionsIds.includes(pendingTx.id),
          ),
        );

        return { prevData };
      },
      onError(err, newOperation, ctx) {
        utils.operations.getPendingTransactions.setData(
          undefined,
          ctx?.prevData,
        );

        toast.error(
          `No se pudo aprobar ${newOperation.pendingTransactionsIds.join(
            ", ",
          )}`,
          {
            description: JSON.stringify(err.message),
          },
        );
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.operations.getPendingTransactions.invalidate();
      },
      onSuccess(data) {
        toast.success(
          `${data.length === 1 ? "Transacción" : "Transacciones"} aprobadas${
            data.length === 1 ? "" : "s"
          }`,
        );
      },
    },
  );

  const mainEntity = (
    fromEntity: RouterOutputs["entities"]["getAll"][number],
    toEntity: RouterOutputs["entities"]["getAll"][number],
    type: "main" | "other",
    tx: RouterOutputs["operations"]["getPendingTransactions"][number],
  ): RouterOutputs["entities"]["getAll"][number] => {
    const mainEntity = mainTags.includes(toEntity.tag.name)
      ? toEntity
      : fromEntity;
    if (type === "main") return mainEntity;
    return mainEntity.id === tx.toEntityId ? tx.fromEntity : tx.toEntity;
  };
  return (
    <div className="flex flex-col gap-y-4">
      <div className="grid grid-rows-2 p-4 lg:grid-cols-9 lg:grid-rows-1">
        <div className="row-span-1 lg:col-span-5"></div>
        <div className="row-span-1 grid grid-cols-3 lg:col-span-4">
          <div className="col-span-1 flex w-full flex-row items-center justify-start">
            <p className="text-3xl font-semibold">Entrada</p>
          </div>
          <div className="col-span-1 flex flex-row items-center justify-start">
            <p className="text-3xl font-semibold">Salida</p>
          </div>
          <div className="col-span-1"></div>
        </div>
      </div>
      {pendingTransactions.map((pendingTx) => (
        <div
          key={pendingTx.id}
          className="grid w-full grid-rows-2 lg:grid-cols-9 lg:grid-rows-1"
        >
          <div className="row-span-1 mr-12 flex flex-row items-center justify-between lg:col-span-5">
            <EntityCard entity={pendingTx.operatorEntity} />
            <div className="flex flex-col items-center justify-center">
              <p className="text-center text-sm font-light text-muted-foreground">
                Tx
                <span className="ml-1 text-black dark:text-white">
                  {numberFormatter(pendingTx.id)}
                </span>
              </p>
            </div>
            <div className="flex flex-row items-center gap-x-4">
              <EntityCard
                entity={mainEntity(
                  pendingTx.fromEntity,
                  pendingTx.toEntity,
                  "main",
                  pendingTx,
                )}
              />
              <div className="flex flex-col items-center justify-center gap-y-2">
                {mainEntity(
                  pendingTx.fromEntity,
                  pendingTx.toEntity,
                  "main",
                  pendingTx,
                ).id === pendingTx.toEntityId ? (
                  <Icons.arrowLeft
                    className={cn(
                      "h-10",
                      pendingTx.status === Status.enumValues[0]
                        ? "text-red"
                        : pendingTx.status === Status.enumValues[1]
                        ? "text-green"
                        : "text-gray",
                    )}
                  />
                ) : (
                  <Icons.arrowRight
                    className={cn(
                      "h-10",
                      pendingTx.status === Status.enumValues[0]
                        ? "text-red"
                        : pendingTx.status === Status.enumValues[1]
                        ? "text-green"
                        : "text-gray",
                    )}
                  />
                )}
                <p className="w-14 text-center">
                  {capitalizeFirstLetter(pendingTx.type)}
                </p>
              </div>
              <EntityCard
                entity={mainEntity(
                  pendingTx.fromEntity,
                  pendingTx.toEntity,
                  "other",
                  pendingTx,
                )}
              />
            </div>
          </div>
          <div className="row-span-1 grid grid-cols-3 lg:col-span-4">
            <div className="col-span-1 flex flex-row items-center justify-start gap-x-1">
              <p className="text-2xl font-light text-muted-foreground">
                {mainEntity(
                  pendingTx.fromEntity,
                  pendingTx.toEntity,
                  "main",
                  pendingTx,
                ).id === pendingTx.toEntityId &&
                  pendingTx.currency.toUpperCase()}
              </p>
              <p className="text-2xl font-semibold">
                {mainEntity(
                  pendingTx.fromEntity,
                  pendingTx.toEntity,
                  "main",
                  pendingTx,
                ).id === pendingTx.toEntityId &&
                  numberFormatter(pendingTx.amount)}
              </p>
            </div>
            <div className="col-span-1 flex flex-row items-center justify-start gap-x-1">
              <p className="text-2xl font-light text-muted-foreground">
                {mainEntity(
                  pendingTx.fromEntity,
                  pendingTx.toEntity,
                  "main",
                  pendingTx,
                ).id === pendingTx.fromEntityId &&
                  pendingTx.currency.toUpperCase()}
              </p>
              <p className="text-2xl font-semibold">
                {mainEntity(
                  pendingTx.fromEntity,
                  pendingTx.toEntity,
                  "main",
                  pendingTx,
                ).id === pendingTx.fromEntityId &&
                  numberFormatter(pendingTx.amount)}
              </p>
            </div>
            <div className="col-span-1 flex items-center justify-center lg:justify-end">
              <Button
                onClick={() =>
                  mutateAsync({ pendingTransactionsIds: [pendingTx.id] })
                }
                disabled={
                  user.email !== "christian@ifc.com.ar" &&
                  user.email !== "tomas.castelli@ifc.com.ar"
                }
              >
                <Icons.check className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingTransactions;
