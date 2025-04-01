import { numberFormatter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/shared";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";

interface BalanceTotalsProps {
  totals: RouterOutputs["movements"]["getBalancesByEntities"];
}

const BalanceTotals = ({ totals }: BalanceTotalsProps) => {
  return (
    <ScrollArea className="h-full w-full">
      {totals.map((total) => (
        <div key={total.currency}>
          <h1 className="text-lg font-semibold">
            {total.currency.toUpperCase()}
          </h1>
          <div>
            <p>{total.account ? "Caja" : "Cuenta corriente"}</p>
            <p
              className={cn(
                "font-bold",
                total.amount > 0
                  ? "text-green"
                  : total.amount < 0
                  ? "text-red"
                  : "",
              )}
            >
              $ {numberFormatter(total.amount === 0 ? 0 : total.amount)}
            </p>
          </div>
          <Separator className="my-1" />
        </div>
      ))}
    </ScrollArea>
  );
};

export default BalanceTotals;
