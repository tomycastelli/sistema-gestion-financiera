"use client"

import { type FC } from "react";
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import Link from "next/link";
import { capitalizeFirstLetter, numberFormatter } from "~/lib/functions";
import { currenciesOrder } from "~/lib/variables";

const transformedBalancesSchema = z.object({
  entity: z.object({
    id: z.number().int(),
    name: z.string(),
    tagName: z.string(),
  }),
  data: z.array(z.object({ currency: z.string(), balance: z.number() })),
});


interface BalancesCardsProps {
  transformedBalances: z.infer<typeof transformedBalancesSchema>[]
  isInverted: boolean
  accountType: boolean;
}

const BalancesCards: FC<BalancesCardsProps> = ({ transformedBalances, isInverted, accountType }) => {
  return (
    <div className="flex flex-col gap-y-4">
      <h1 className="text-3xl font-semibold tracking-tighter">Entidades</h1>
      <div className="grid-cols grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {transformedBalances
          .sort((a, b) => a.entity.name.localeCompare(b.entity.name))
          .map((item) => (
            <Card
              key={item.entity.id}
              className="min-w-[300px] transition-all hover:scale-105 hover:shadow-md hover:shadow-primary"
            >
              <Link
                prefetch={false}
                href={{
                  pathname: "/cuentas",
                  query: {
                    cuenta: accountType ? "caja" : "cuenta_corriente",
                    entidad: item.entity.id,
                  },
                }}
              >
                <CardHeader>
                  <CardTitle>{item.entity.name}</CardTitle>
                  <CardDescription>
                    {capitalizeFirstLetter(item.entity.tagName)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col space-y-2">
                    {item.data
                      .sort(
                        (a, b) =>
                          currenciesOrder.indexOf(a.currency) -
                          currenciesOrder.indexOf(b.currency),
                      )
                      .map((balances) => (
                        <div
                          key={balances.currency}
                          className="grid grid-cols-3"
                        >
                          <p className="col-span-1">
                            {balances.currency.toUpperCase()}
                          </p>
                          <p className="col-span-2 text-xl font-bold">
                            ${" "}
                            {numberFormatter(
                              !isInverted
                                ? balances.balance
                                : -balances.balance,
                            )}
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
      </div>
    </div>
  )
}

export default BalancesCards
