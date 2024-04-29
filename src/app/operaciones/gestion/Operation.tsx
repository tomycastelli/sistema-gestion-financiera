"use client"

import moment from "moment"
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared"
import Transaction from "./Transaction"
import { memo, useState } from "react";
import CustomPagination from "~/app/components/CustomPagination";
import OperationButtons from "./OperationButtons";
import { type User } from "lucia";
import { Status } from "~/server/db/schema";
import { cn } from "~/lib/utils";
import { numberFormatter } from "~/lib/functions";
import dynamic from "next/dynamic";
const OperationDrawer = dynamic(() => import("~/app/components/OperationDrawer"))
import { Button } from "~/app/components/ui/button";

interface OperationProps {
  op: RouterOutputs["operations"]["getOperations"]["operations"][number];
  mainTags: string[]
  operationsQueryInput: RouterInputs["operations"]["getOperations"]
  user: User
  entities: RouterOutputs["entities"]["getFiltered"]
  isInFeed: boolean;
  users: RouterOutputs["users"]["getAll"]
  accountingPeriodDate: Date
}

const Operation = memo(({ op, mainTags, operationsQueryInput, user, isInFeed, entities, users, accountingPeriodDate }: OperationProps) => {
  const pageSize = 8
  const [page, setPage] = useState<number>(1)

  return (
    <div
      className={cn("flex flex-col justify-start gap-y-4 w-full rounded-lg border-2 p-4 shadow-md",
        op.transactions.filter((tx) => tx.status === Status.enumValues[0])
          .length === op.transactions.length
          ? "border-red"
          : op.transactions.filter((tx) => tx.status === Status.enumValues[1])
            .length === op.transactions.length
            ? "border-green"
            : "",
      )}
    >
      <div className="flex w-full justify-between items-start">
        <div className="flex flex-col gap-y-1">
          {isInFeed ? (
            <OperationDrawer
              entities={entities}
              user={user}
              op={op}
              accountingPeriodDate={accountingPeriodDate}
              mainTags={mainTags} users={users}>
              <Button className="hover:scale-105 transition-all focus-visible:ring-transparent border-transparent p-0 w-min" variant="outline">
                <h1 className="font-semibold text-2xl text-muted-foreground">Operación <span className="text-black dark:text-white">{numberFormatter(op.id)}</span></h1>
              </Button>
            </OperationDrawer>
          ) : (
            <h1 className="font-semibold text-2xl text-muted-foreground">Operación <span className="text-black dark:text-white">{numberFormatter(op.id)}</span></h1>
          )}
          <h2 className="font-light text-lg text-muted-foreground">{moment(op.date).format("DD-MM-YYYY HH:mm")}</h2>
          <p className="text-lg font-light">{op.observations}</p>
        </div>
        <OperationButtons accountingPeriodDate={accountingPeriodDate} operationsQueryInput={operationsQueryInput} op={op} user={user} />
      </div>
      <div className="grid grid-cols-1 gap-y-4">
        {op.transactions.slice((page - 1) * pageSize, page * pageSize).map(tx => (
          <Transaction users={users} isInFeed={isInFeed} entities={entities} operationsQueryInput={operationsQueryInput} key={tx.id} tx={tx} mainTags={mainTags} />
        ))}
      </div>
      {op.transactions.length >= pageSize && (
        <CustomPagination pageSize={pageSize} page={page} itemName="transacciones" totalCount={op.transactions.length} changePageState={setPage} />
      )}
    </div>
  )
})

Operation.displayName = "Operation";

export default Operation
