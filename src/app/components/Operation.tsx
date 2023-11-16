import type { User } from "next-auth";
import Link from "next/link";
import type { FC } from "react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import Transaction from "./Transaction";
import { Icons } from "./ui/Icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface OperationProps {
  operation: RouterOutputs["operations"]["getOperations"][number];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  entities: RouterOutputs["entities"]["getAll"];
  user: User;
}

const Operation: FC<OperationProps> = ({
  operation: op,
  operationsQueryInput,
  user,
  entities,
}) => {
  return (
    <div className="my-4 flex flex-col">
      <Card>
        <CardHeader>
          <div className="flex w-full flex-row justify-between">
            <CardTitle>{op.id}</CardTitle>
            <Link
              href={`/operaciones/gestionar/${op.id}`}
              className="text-black transition-all hover:scale-125"
            >
              <Icons.externalLink className="h-8" />
            </Link>
          </div>
          <CardDescription className="text-lg">
            {op.date.toLocaleString("es-AR")}
          </CardDescription>
          <CardDescription>{op.observations}</CardDescription>
        </CardHeader>
        <CardContent>
          {op.transactions
            .sort((a, b) => b.id - a.id)
            .map((tx, txIdx) => (
              <Transaction
                entities={entities}
                transaction={tx}
                key={tx.id}
                operationsQueryInput={operationsQueryInput}
                txIdx={txIdx}
                user={user}
              />
            ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Operation;
