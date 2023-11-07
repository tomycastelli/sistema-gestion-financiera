import type { User } from "next-auth";
import type { FC } from "react";
import { cn } from "~/lib/utils";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import TransactionStatusButton from "./TransactionStatusButton";
import UpdateTransaction from "./forms/UpdateTransaction";
import EntityCard from "./ui/EntityCard";
import { Button } from "./ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Icons } from "./ui/icons";

interface TransactionProps {
  transaction: RouterOutputs["operations"]["getOperations"][number]["transactions"][number];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  txIdx: number;
  user: User;
  initialEntities: RouterOutputs["entities"]["getAll"];
}

const Transaction: FC<TransactionProps> = ({
  transaction: tx,
  operationsQueryInput,
  txIdx,
  user,
  initialEntities,
}) => {
  return (
    <div className="mb-8 grid grid-cols-8">
      <div className="col-span-3 mr-8 flex flex-row items-center space-x-2 justify-self-end">
        <div>
          {txIdx === 0 && (
            <h1 className="mb-1 text-lg tracking-tighter text-black">
              Operador
            </h1>
          )}
          <EntityCard entity={tx.operatorEntity} />
        </div>
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link" className="text-black">
              <Icons.info className="h-8" />
            </Button>
          </HoverCardTrigger>
          <HoverCardContent>
            <p>
              Cargado por:{" "}
              <span>{tx.transactionMetadata?.uploadedByUser.name}</span>{" "}
            </p>
            {tx.transactionMetadata?.confirmedByUser && (
              <p>
                Confirmado por:{" "}
                <span>{tx.transactionMetadata?.confirmedByUser?.name}</span>{" "}
              </p>
            )}
          </HoverCardContent>
        </HoverCard>
      </div>
      <div className="col-span-5 grid grid-cols-3 justify-self-start">
        <div className="justify-self-end">
          {txIdx === 0 && (
            <h1 className="mb-1 text-lg tracking-tighter text-black">Origen</h1>
          )}
          <EntityCard entity={tx.fromEntity} />
        </div>
        <div className="flex flex-col items-center space-y-2 justify-self-center">
          <p className="text-muted-foreground">
            {tx.currency.toUpperCase()}{" "}
            <span className="text-black">{tx.amount}</span>{" "}
          </p>
          <Icons.arrowRight className="h-16 text-black" />
          <div className="flex w-3/4 flex-row items-center justify-center space-x-2">
            <div className="flex items-center justify-center">
              <TransactionStatusButton
                transaction={tx}
                operationsQueryInput={operationsQueryInput}
                user={user}
              />
            </div>
            <UpdateTransaction
              transaction={tx}
              operationsQueryInput={operationsQueryInput}
              initialEntities={initialEntities}
            />
          </div>
          <p className="text-sm font-light text-muted-foreground">
            Tx <span className="text-black">{tx.id}</span>
          </p>
        </div>
        <div className="justify-self-start">
          {txIdx === 0 && (
            <h1 className="mb-1 text-lg tracking-tighter text-black">
              Destino
            </h1>
          )}
          <EntityCard entity={tx.toEntity} />
        </div>
      </div>
    </div>
  );
};

export default Transaction;
