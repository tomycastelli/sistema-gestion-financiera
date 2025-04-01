import dynamic from "next/dynamic";
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
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const EntityNode = (
  props: NodeProps<RouterOutputs["entities"]["getAll"][number]>,
) => {
  const { data: balances, isLoading } =
    api.movements.getBalancesByEntities.useQuery(
      { entityId: props.data.id, balanceType: "2", account: true },
      { staleTime: 182000 },
    );

  return (
    <Card
      style={{ borderColor: props.data.tag.color ?? undefined }}
      className={cn(`rounded-full border-2`)}
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
