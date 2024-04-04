"use client";

import dynamic from "next/dynamic";
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import Link from "next/link";
import React, { useState } from "react";
import loadingJson from "~/../public/animations/loading.json";
import { capitalizeFirstLetter } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import BalanceTotals from "../BalanceTotals";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

interface EntityCardProps {
  entity: RouterOutputs["entities"]["getAll"][number];
  className?: string;
}

const EntityCard = React.memo(({ entity }: EntityCardProps) => {
  const [enableQueryId, setEnableQueryId] = useState<boolean>(false);
  const [enableQueryTag, setEnableQueryTag] = useState<boolean>(false);

  const { data: balances, isLoading } =
    api.movements.getBalancesByEntitiesForCard.useQuery(
      { entityId: entity?.id },
      { enabled: enableQueryId, refetchOnWindowFocus: false, staleTime: 5000 },
    );

  const { data: balancesTag, isLoading: isLoadingTag } =
    api.movements.getBalancesByEntitiesForCard.useQuery(
      { entityTag: entity.tag.name },
      { enabled: enableQueryTag, refetchOnWindowFocus: false, staleTime: 5000 },
    );

  return (
    <>
      {entity ? (
        <Card
          className="flex h-36 border-2 w-36 flex-col shadow-md"
          style={{ borderColor: entity.tag.color ?? undefined }}
        >
          <CardHeader>
            <HoverCard onOpenChange={setEnableQueryId}>
              <HoverCardTrigger asChild>
                <CardTitle>
                  <Link
                    prefetch={false}
                    className={cn(
                      "flex transition-all hover:scale-110",
                      entity.name.length <= 15 ? "text-2xl" : "text-[20px]",
                    )}
                    href={{
                      pathname: "/cuentas",
                      query: { entidad: entity.id },
                    }}
                  >
                    {entity.name}
                  </Link>
                </CardTitle>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                {!isLoading ? (
                  balances ? (
                    <BalanceTotals totals={balances} />
                  ) : (
                    <p>No tiene movimientos</p>
                  )
                ) : (
                  <Lottie
                    animationData={loadingJson}
                    className="h-72"
                    loop={true}
                  />
                )}
              </HoverCardContent>
            </HoverCard>
            <HoverCard onOpenChange={setEnableQueryTag}>
              <HoverCardTrigger asChild>
                <CardDescription className="text-md">
                  <Link
                    prefetch={false}
                    className="flex transition-all hover:scale-110"
                    href={{
                      pathname: "/cuentas",
                      query: { tag: entity.tag.name },
                    }}
                  >
                    {capitalizeFirstLetter(entity.tag.name)}
                  </Link>
                </CardDescription>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                {!isLoadingTag ? (
                  balancesTag ? (
                    <BalanceTotals totals={balancesTag} />
                  ) : (
                    <p>No tiene movimientos</p>
                  )
                ) : (
                  <Lottie
                    animationData={loadingJson}
                    className="h-72"
                    loop={true}
                  />
                )}
              </HoverCardContent>
            </HoverCard>
          </CardHeader>
        </Card>
      ) : (
        <p>Entity not found</p>
      )}
    </>
  );
});

EntityCard.displayName = "EntityCard";

export default EntityCard;
