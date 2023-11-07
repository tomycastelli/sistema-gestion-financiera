import type { User } from "next-auth";
import type { FC } from "react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import Transaction from "./Transaction";
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
  initialEntities: RouterOutputs["entities"]["getAll"];
  user: User;
}

const Operation: FC<OperationProps> = ({
  operation: op,
  operationsQueryInput,
  user,
  initialEntities,
}) => {
  return (
    <div className="my-4 flex flex-col">
      <Card>
        <CardHeader>
          <CardTitle>{op.id}</CardTitle>
          <CardTitle>{op.date.toLocaleDateString("es-AR")}</CardTitle>
          <CardDescription>{op.observations}</CardDescription>
        </CardHeader>
        <CardContent>
          {op.transactions
            .sort((a, b) => b.id - a.id)
            .map((tx, txIdx) => (
              <Transaction
                initialEntities={initialEntities}
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
