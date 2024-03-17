"use client";

import Lottie from "lottie-react";
import Link from "next/link";
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
                <CardTitle>
                  <Link
                    prefetch={false}
                    href={`/operaciones/gestion/${op.id}`}
                    className="flex text-black transition-all hover:scale-105 dark:text-white"
                  >
                    Operación {op.id !== 0 ? op.id : "..."}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {op.date ? formatDateString(op.date.toString()) : ""}
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
