"use client";

import moment from "moment";
import { forwardRef } from "react";
import type { RouterOutputs } from "~/trpc/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import OperationDrawer from "./OperationDrawer";
import { Button } from "./ui/button";
import { numberFormatter } from "~/lib/functions";
import { type User } from "lucia";
import { api } from "~/trpc/react";
import LoadingAnimation from "./LoadingAnimation";

interface UploadedUserOperationsProps {
  operationsData: RouterOutputs["operations"]["getOperations"]
  mainTags: string[]
  entities: RouterOutputs["entities"]["getAll"];
  user: User
  users: RouterOutputs["users"]["getAll"]
  accountingPeriodDate: Date
}

const UploadedUserOperations = forwardRef<
  HTMLDivElement,
  UploadedUserOperationsProps
>(function UploadedUserOperations(
  { operationsData, accountingPeriodDate, users, user, entities, mainTags }: UploadedUserOperationsProps,
  ref,
) {
  const { data, isRefetching, isSuccess } = api.operations.getOperations.useQuery({ page: 1, limit: 5, uploadedById: user.id }, { refetchOnWindowFocus: false, initialData: operationsData })

  return !isRefetching ? isSuccess && data.operations.length > 0 && (
    <div ref={ref} className="grid grid-cols-3 gap-4 lg:grid-cols-1">
      {data.operations.map((op) => (
        <Card key={op.id}>
          <CardHeader>
            <CardTitle>
              <OperationDrawer
                mainTags={mainTags}
                entities={entities}
                user={user}
                users={users}
                accountingPeriodDate={accountingPeriodDate}
                op={op}
              >
                <Button className="hover:scale-105 transition-all focus-visible:ring-transparent border-transparent p-0 w-min" variant="outline">
                  <h1 className="font-semibold text-2xl text-muted-foreground">Operación <span className="text-black dark:text-white">{numberFormatter(op.id)}</span></h1>
                </Button>
              </OperationDrawer>
            </CardTitle>
            <CardDescription>
              {op.date ? moment(op.date).format("DD-MM-YYYY HH:mm") : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-md text-muted-foreground">
              {op.observations}
            </p>
            <p className="text-md">
              <span className="mr-2 text-primary">
                {op.transactions.length}
              </span>
              {op.transactions.length > 1 ? "Transacciones" : "Transacción"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (<LoadingAnimation text="Cargando operaciones..." />);
});

UploadedUserOperations.displayName = "UploadedUserOperations";

export default UploadedUserOperations;
