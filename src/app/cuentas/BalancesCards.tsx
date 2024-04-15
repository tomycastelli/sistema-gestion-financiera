"use client"

import { type FC } from "react";
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import Link from "next/link";
import { capitalizeFirstLetter } from "~/lib/functions";
import { currenciesOrder } from "~/lib/variables";
import Lottie from "lottie-react";
import loadingJson from "../../../public/animations/loading.json";

const transformedBalancesSchema = z.object({
  entity: z.object({
    id: z.number().int(),
    name: z.string(),
    tagName: z.string(),
  }),
  data: z.array(z.object({ currency: z.string(), balance: z.number() })),
});


interface BalancesCardsProps {
  isBalanceLoading: boolean
  transformedBalances: z.infer<typeof transformedBalancesSchema>[]
  isFetching: boolean
  isInverted: boolean
  accountType: boolean;
}

const BalancesCards: FC<BalancesCardsProps> = ({ isBalanceLoading, transformedBalances, isFetching, isInverted, accountType }) => {
  return (
    <div className="flex flex-col gap-y-4">
      <h1 className="text-3xl font-semibold tracking-tighter">Entidades</h1>
      <div className="grid-cols grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!isBalanceLoading ? (
          transformedBalances
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
                            {!isFetching ? (
                              <p className="col-span-2 text-xl font-bold">
                                ${" "}
                                {new Intl.NumberFormat("es-AR").format(
                                  !isInverted
                                    ? balances.balance
                                    : -balances.balance,
                                )}
                              </p>
                            ) : (
                              <p>Cargando...</p>
                            )}
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))
        ) : (
          <Lottie animationData={loadingJson} className="h-24" loop={true} />
        )}
      </div>
    </div>
  )
}

export default BalancesCards
