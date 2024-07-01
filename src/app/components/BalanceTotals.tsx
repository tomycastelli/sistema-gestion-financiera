import { cn } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/shared";
import { Separator } from "./ui/separator";
import { numberFormatter } from "~/lib/functions";
import { ScrollArea } from "./ui/scroll-area";

interface BalanceTotalsProps {
  totals: RouterOutputs["movements"]["getBalancesByEntitiesForCard"];
}

const BalanceTotals = ({ totals }: BalanceTotalsProps) => {
  return (
    <ScrollArea className="h-full w-full">
      {totals.map((total) => (
        <div key={total.currency}>
          <h1 className="text-lg font-semibold">
            {total.currency.toUpperCase()}
          </h1>
          {total.balances.map((balance, index) => (
            <div key={index}>
              <p>{balance.account ? "Caja" : "Cuenta corriente"}</p>
              <p
                className={cn(
                  "font-bold",
                  balance.amount > 0
                    ? "text-green"
                    : balance.amount < 0
                      ? "text-red"
                      : "",
                )}
              >
                $ {numberFormatter(balance.amount === 0 ? 0 : balance.amount)}
              </p>
            </div>
          ))}
          <Separator className="my-1" />
        </div>
      ))}
    </ScrollArea>
  );
};

export default BalanceTotals;
