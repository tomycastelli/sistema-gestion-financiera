import { type calculateTotalAllEntities } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { Separator } from "./ui/separator";

interface BalanceTotalsProps {
  totals: ReturnType<typeof calculateTotalAllEntities>;
}

const BalanceTotals = ({ totals }: BalanceTotalsProps) => {
  return (
    <div>
      {totals.map((total) => (
        <div key={total.currency}>
          <h1 className="text-lg font-semibold">
            {total.currency.toUpperCase()}
          </h1>
          {total.balances.map((balance, index) => (
            <div key={index}>
              <p>{balance.status ? "Caja" : "Cuenta corriente"}</p>
              <div className="flex flex-row space-x-2">
                <p className="font-bold">
                  $ {new Intl.NumberFormat("es-AR").format(balance.amount)}
                </p>
                <p
                  className={cn(
                    "text-lg font-semibold",
                    balance.amount - balance.beforeAmount > 0
                      ? "text-green"
                      : balance.amount - balance.beforeAmount < 0
                      ? "text-red"
                      : "text-slate-300",
                  )}
                >
                  {(balance.amount - balance.beforeAmount > 0
                    ? "+"
                    : balance.amount - balance.beforeAmount < 0
                    ? ""
                    : " ") +
                    new Intl.NumberFormat("es-AR").format(
                      balance.amount - balance.beforeAmount,
                    )}
                </p>
              </div>
            </div>
          ))}
          <Separator className="my-2" />
        </div>
      ))}
    </div>
  );
};

export default BalanceTotals;
