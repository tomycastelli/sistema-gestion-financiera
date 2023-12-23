import Lottie from "lottie-react";
import Link from "next/link";
import { Handle, Position, type NodeProps } from "reactflow";
import loadingJson from "~/../public/animations/loading.json";
import BalanceTotals from "~/app/components/BalanceTotals";
import { Card, CardHeader, CardTitle } from "~/app/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/app/components/ui/hover-card";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

const EntityNode = (
  props: NodeProps<RouterOutputs["entities"]["getAll"][number]>,
) => {
  const { data: balances, isLoading } =
    api.movements.getBalancesByEntitiesForCard.useQuery(
      { entityId: props.data.id },
      { refetchOnReconnect: false, staleTime: 182000 },
    );

  return (
    <Card
      className={cn(`border-2 border-${props.data.tag.color} rounded-full`)}
    >
      <Handle type="target" position={Position.Top} />
      <CardHeader>
        <HoverCard>
          <HoverCardTrigger asChild>
            <CardTitle>
              <Link
                className="flex transition-all hover:scale-110"
                href={{
                  pathname: "/cuentas",
                  query: { entidad: props.data.id },
                }}
              >
                {props.data.name}
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
      </CardHeader>
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};

export default EntityNode;
