"use client";

import Lottie from "lottie-react";
import { forwardRef } from "react";
import { formatDateString } from "~/lib/functions";
import type { RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface UploadedUserOperationsProps {
  operations: RouterOutputs["operations"]["getOperationsByUser"] | undefined;
  isLoading: boolean;
}

const UploadedUserOperations = forwardRef<
  HTMLDivElement,
  UploadedUserOperationsProps
>(function UploadedUserOperations(
  { operations, isLoading }: UploadedUserOperationsProps,
  ref,
) {
  return (
    <>
      {operations && operations.length > 0 && (
        <div ref={ref} className="grid grid-cols-3 gap-4 lg:grid-cols-1">
          {operations.map((op, index) => (
            <Card key={op.id}>
              <CardHeader>
                <CardTitle>Operación {op.id}</CardTitle>
                <CardDescription>
                  {op.date ? formatDateString(op.date.toString()) : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-md text-muted-foreground">
                  {op.observations}
                </p>
                {op._count && (
                  <p className="text-md">
                    <span className="mr-2 text-primary">
                      {op._count.transactions}
                    </span>
                    {op._count.transactions > 1
                      ? "Transacciones"
                      : "Transacción"}
                  </p>
                )}
                <div className="flex w-full flex-row justify-between">
                  {!op.status ? (
                    <div className="flex flex-row">
                      <span className="mr-2 rounded-full bg-green p-1"></span>
                      <p>Activa</p>
                    </div>
                  ) : (
                    <div className="flex flex-row">
                      <span className="bg-red p-1"></span>
                      <p>Anulada</p>
                    </div>
                  )}
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
