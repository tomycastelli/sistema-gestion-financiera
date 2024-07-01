"use client";

import EntityCard from "~/app/components/ui/EntityCard";
import { capitalizeFirstLetter, numberFormatter } from "~/lib/functions";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";
import TransactionButtons from "./TransactionButtons";
import TransactionInfo from "./[operationId]/TransactionInfo";
import { cn } from "~/lib/utils";
import { Status } from "~/server/db/schema";
import { Icons } from "~/app/components/ui/Icons";
import { memo } from "react";

interface TransactionProps {
  tx: RouterOutputs["operations"]["getOperations"]["operations"][number]["transactions"][number];
  mainTags: string[];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  entities: RouterOutputs["entities"]["getFiltered"];
  isInFeed: boolean;
  users: RouterOutputs["users"]["getAll"];
}

const Transaction = memo(
  ({
    tx,
    mainTags,
    operationsQueryInput,
    entities,
    isInFeed,
    users,
  }: TransactionProps) => {
    const mainEntity = mainTags.includes(tx.toEntity.tag.name)
      ? tx.toEntity
      : tx.fromEntity;
    const otherEntity =
      mainEntity.id === tx.toEntityId ? tx.fromEntity : tx.toEntity;

    return (
      <div className="grid w-full grid-rows-2 lg:grid-cols-9 lg:grid-rows-1">
        <div className="row-span-1 mr-12 flex flex-row items-center justify-between lg:col-span-5">
          <EntityCard entity={tx.operatorEntity} />
          <div className="flex flex-col items-center justify-center">
            <TransactionInfo
              isInFeed={isInFeed}
              users={users}
              entities={entities}
              tx={tx}
            />
            <p className="text-center text-sm font-light text-muted-foreground">
              Tx
              <span className="ml-1 text-black dark:text-white">
                {numberFormatter(tx.id)}
              </span>
            </p>
          </div>
          <div className="flex flex-row items-center gap-x-4">
            <EntityCard entity={mainEntity} />
            <div className="flex flex-col items-center justify-center gap-y-2">
              {mainEntity.id === tx.toEntityId ? (
                <Icons.arrowLeft
                  className={cn(
                    "h-10",
                    tx.status === Status.enumValues[0]
                      ? "text-red"
                      : tx.status === Status.enumValues[1]
                        ? "text-green"
                        : "text-gray",
                  )}
                />
              ) : (
                <Icons.arrowRight
                  className={cn(
                    "h-10",
                    tx.status === Status.enumValues[0]
                      ? "text-red"
                      : tx.status === Status.enumValues[1]
                        ? "text-green"
                        : "text-gray",
                  )}
                />
              )}
              <p className="w-14 text-center">
                {capitalizeFirstLetter(tx.type)}
              </p>
            </div>
            <EntityCard entity={otherEntity} />
          </div>
        </div>
        <div className="row-span-1 grid grid-cols-3 lg:col-span-4">
          <div className="col-span-1 flex flex-row items-center justify-start gap-x-1">
            <p className="text-2xl font-light text-muted-foreground">
              {mainEntity.id === tx.toEntityId && tx.currency.toUpperCase()}
            </p>
            <p className="text-2xl font-semibold">
              {mainEntity.id === tx.toEntityId && numberFormatter(tx.amount)}
            </p>
          </div>
          <div className="col-span-1 flex flex-row items-center justify-start gap-x-1">
            <p className="text-2xl font-light text-muted-foreground">
              {mainEntity.id === tx.fromEntityId && tx.currency.toUpperCase()}
            </p>
            <p className="text-2xl font-semibold">
              {mainEntity.id === tx.fromEntityId && numberFormatter(tx.amount)}
            </p>
          </div>
          <div className="col-span-1 flex items-center justify-center lg:justify-end">
            <TransactionButtons
              tx={tx}
              operationsQueryInput={operationsQueryInput}
              entities={entities}
            />
          </div>
        </div>
      </div>
    );
  },
);

Transaction.displayName = "Transaction";

export default Transaction;
