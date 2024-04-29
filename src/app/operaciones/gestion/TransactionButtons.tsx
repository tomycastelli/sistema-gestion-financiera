"use client"
import { type FC } from "react";
import dynamic from "next/dynamic";
const UpdateTransaction = dynamic(() => import("~/app/components/forms/UpdateTransaction"))
import { Icons } from "~/app/components/ui/Icons";
import { Button } from "~/app/components/ui/button";
import { cn } from "~/lib/utils";
import { Status } from "~/server/db/schema";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

interface TransactionButtonsProps {
  tx: RouterOutputs["operations"]["getOperations"]["operations"][number]["transactions"][number]
  operationsQueryInput: RouterInputs["operations"]["getOperations"]
  entities: RouterOutputs["entities"]["getFiltered"]
}

const TransactionButtons: FC<TransactionButtonsProps> = ({ tx, operationsQueryInput, entities }) => {
  const { txIdsStore, changeTxIds } = useOperationsPageStore();

  return (
    <div className="flex flex-col gap-y-1">
      <Button
        variant="outline"
        disabled={!tx.isValidateAllowed}
        onClick={() => {
          changeTxIds(tx.id);
        }}
        className={cn(
          "rounded-full border-2 border-transparent bg-transparent p-2",
          txIdsStore.includes(tx.id) ? "bg-primary text-white" : "bg-transparent text-black dark:text-white",
        )}
      >
        {tx.status === Status.enumValues[1] ? (
          <Icons.check className="h-8 text-green" />
        ) : tx.status === Status.enumValues[0] ? (
          <Icons.valueNone className="h-8 text-green" />
        ) : (
          <Icons.clock className="h-7" />
        )}
      </Button>
      <UpdateTransaction
        transaction={tx}
        operationsQueryInput={operationsQueryInput}
        entities={entities}
      />
    </div>
  )
}

export default TransactionButtons
