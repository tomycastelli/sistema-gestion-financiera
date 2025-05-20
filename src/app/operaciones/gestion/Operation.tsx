"use client";

import { type User } from "lucia";
import moment from "moment";
import dynamic from "next/dynamic";
import { memo, useState } from "react";
import CustomPagination from "~/app/components/CustomPagination";
import { Button } from "~/app/components/ui/button";
import { numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { Status } from "~/server/db/schema";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";
import OperationButtons from "./OperationButtons";
import Transaction from "./Transaction";
const OperationDrawer = dynamic(
  () => import("~/app/components/OperationDrawer"),
);

interface OperationProps {
  op: RouterOutputs["operations"]["getOperations"]["operations"][number];
  mainTags: string[];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  user: User;
  entities: RouterOutputs["entities"]["getFiltered"];
  isInFeed: boolean;
  users: RouterOutputs["users"]["getAll"];
  accountingPeriodDate: Date;
}

const Operation = memo(
  ({
    op,
    mainTags,
    operationsQueryInput,
    user,
    isInFeed,
    entities,
    users,
    accountingPeriodDate,
  }: OperationProps) => {
    const pageSize = 8;
    const [page, setPage] = useState<number>(1);

    return (
      <div
        className={cn(
          "flex w-full flex-col justify-start gap-y-4 rounded-lg border-2 p-4 shadow-md",
          op.transactions.filter((tx) => tx.status === Status.enumValues[0])
            .length === op.transactions.length
            ? "border-red"
            : op.transactions.filter((tx) => tx.status === Status.enumValues[1])
                .length === op.transactions.length
            ? "border-green"
            : "",
        )}
      >
        <div className="flex w-full items-start justify-between">
          <div className="flex flex-col gap-y-1">
            {isInFeed ? (
              <OperationDrawer
                entities={entities}
                user={user}
                op={op}
                accountingPeriodDate={accountingPeriodDate}
                mainTags={mainTags}
                users={users}
              >
                <Button
                  className="w-min border-transparent p-0 transition-all hover:scale-105 focus-visible:ring-transparent"
                  variant="outline"
                >
                  <h1 className="text-2xl font-semibold text-muted-foreground">
                    Operación{" "}
                    <span className="text-black dark:text-white">
                      {numberFormatter(op.id)}
                    </span>
                  </h1>
                </Button>
              </OperationDrawer>
            ) : (
              <h1 className="text-2xl font-semibold text-muted-foreground">
                Operación{" "}
                <span className="text-black dark:text-white">
                  {numberFormatter(op.id)}
                </span>
              </h1>
            )}
            <h2 className="text-lg font-light text-muted-foreground">
              {moment(op.date).format("DD-MM-YYYY HH:mm")}
            </h2>
            <p className="text-lg font-light">{op.observations}</p>
          </div>
          <OperationButtons
            accountingPeriodDate={accountingPeriodDate}
            operationsQueryInput={operationsQueryInput}
            op={op}
          />
        </div>
        <div className="grid grid-cols-1 gap-y-4">
          {op.transactions
            .slice((page - 1) * pageSize, page * pageSize)
            .map((tx) => (
              <Transaction
                users={users}
                isInFeed={isInFeed}
                entities={entities}
                operationsQueryInput={operationsQueryInput}
                key={tx.id}
                tx={tx}
                mainTags={mainTags}
              />
            ))}
        </div>
        {op.transactions.length >= pageSize && (
          <CustomPagination
            pageSize={pageSize}
            page={page}
            itemName="transacciones"
            totalCount={op.transactions.length}
            changePageState={setPage}
          />
        )}
      </div>
    );
  },
);

Operation.displayName = "Operation";

export default Operation;
