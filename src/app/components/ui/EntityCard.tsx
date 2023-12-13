"use client";

import Lottie from "lottie-react";
import Link from "next/link";
import React, { useState } from "react";
import loadingJson from "~/../public/animations/loading.json";
import {
  calculateTotalAllEntities,
  capitalizeFirstLetter,
} from "~/lib/functions";
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
      { refetchOnReconnect: false, staleTime: 182000, enabled: enableQueryId },
    );

  const { data: balancesTag, isLoading: isLoadingTag } =
    api.movements.getBalancesByEntitiesForCard.useQuery(
      { entityTag: entity.tag.name },
      { refetchOnReconnect: false, staleTime: 182000, enabled: enableQueryTag },
    );

  let totals: ReturnType<typeof calculateTotalAllEntities> = [];
  if (balances) {
    totals = calculateTotalAllEntities(balances, "daily");
  }

  let totalsTag: ReturnType<typeof calculateTotalAllEntities> = [];
  if (balancesTag) {
    totalsTag = calculateTotalAllEntities(balancesTag, "daily");
  }

  return (
    <>
      {entity ? (
        <Card
          className={cn(
            "flex h-36 w-36 flex-col border",
            entity.tag.color === "primary"
              ? "border-primary"
              : entity.tag.color === "green"
              ? "border-green"
              : entity.tag.color === "orange"
              ? "border-orange"
              : "",
          )}
        >
          <CardHeader>
            <HoverCard onOpenChange={(open) => setEnableQueryId(open)}>
              <HoverCardTrigger asChild>
                <CardTitle>
                  <Link
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
                  totals ? (
                    <BalanceTotals totals={totals} />
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
            <HoverCard onOpenChange={(open) => setEnableQueryTag(open)}>
              <HoverCardTrigger asChild>
                <CardDescription className="text-md">
                  <Link
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
                  totalsTag ? (
                    <BalanceTotals totals={totalsTag} />
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
