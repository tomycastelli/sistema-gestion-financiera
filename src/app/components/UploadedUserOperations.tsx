"use client";

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import moment from "moment";
import { forwardRef } from "react";
import type { RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import dynamic from "next/dynamic";
import OperationDrawer from "./OperationDrawer";
import { Button } from "./ui/button";
import { numberFormatter } from "~/lib/functions";
import { type User } from "lucia";

interface UploadedUserOperationsProps {
  operations: RouterOutputs["operations"]["getOperationsByUser"] | undefined;
  isLoading: boolean;
  mainTags: string[]
  entities: RouterOutputs["entities"]["getAll"];
  user: User | null;
  users: RouterOutputs["users"]["getAll"]
  accountingPeriodDate: Date
}

const UploadedUserOperations = forwardRef<
  HTMLDivElement,
  UploadedUserOperationsProps
>(function UploadedUserOperations(
  { operations, isLoading, accountingPeriodDate, users, user, entities, mainTags }: UploadedUserOperationsProps,
  ref,
) {
  return (
    <>
      {operations && user && operations.length > 0 && (
        <div ref={ref} className="grid grid-cols-3 gap-4 lg:grid-cols-1">
          {operations.map((op, index) => (
            <Card key={op.id}>
              <CardHeader>
                <CardTitle>
                  <OperationDrawer
                    mainTags={mainTags}
                    entities={entities}
                    user={user}
                    users={users}
                    accountingPeriodDate={accountingPeriodDate}
                    opId={op.id}
                  >
                    <Button className="hover:scale-105 transition-all focus-visible:ring-transparent border-transparent p-0 w-min" variant="outline">
                      <h1 className="font-semibold text-2xl text-muted-foreground">Operación <span className="text-black dark:text-white">{numberFormatter(op.id)}</span></h1>
                    </Button>
                  </OperationDrawer>
                </CardTitle>
                <CardDescription>
                  {op.date ? moment(op.date).format("DD-MM-YYYY: HH:mm") : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-md text-muted-foreground">
                  {op.observations}
                </p>
                <p className="text-md">
                  <span className="mr-2 text-primary">
                    {op.transactionsCount}
                  </span>
                  {op.transactionsCount > 1 ? "Transacciones" : "Transacción"}
                </p>
                <div className="flex w-full flex-row justify-between">
                  {isLoading && index === 0 ? (
                    <Lottie
                      animationData={loadingJson}
                      className="flex h-12"
                      loop={true}
                    />
                  ) : (
                    ""
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
});

UploadedUserOperations.displayName = "UploadedUserOperations";

export default UploadedUserOperations;
