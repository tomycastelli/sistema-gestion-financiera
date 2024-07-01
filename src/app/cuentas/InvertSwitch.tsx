"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FC } from "react";
import { useCuentasStore } from "~/stores/cuentasStore";
import { type RouterOutputs } from "~/trpc/shared";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../components/ui/hover-card";
import { Switch } from "../components/ui/switch";

interface InvertSwitchProps {
  entities: RouterOutputs["entities"]["getAll"];
  uiColor: string | undefined;
}

const InvertSwitch: FC<InvertSwitchProps> = ({ entities, uiColor }) => {
  const { isInverted, setIsInverted } = useCuentasStore();
  const searchParams = useSearchParams();
  const selectedEntityIdString = searchParams.get("entidad");
  const selectedEntityId = selectedEntityIdString
    ? parseInt(selectedEntityIdString)
    : null;
  const selectedTag = searchParams.get("tag");

  const [isSwitchDisabled, setIsSwitchDisabled] = useState<boolean>(false);

  useEffect(() => {
    if (
      entities.find((e) => e.id === selectedEntityId)?.tag.name === "Maika" ||
      selectedTag === "Maika"
    ) {
      setIsInverted(false);
      setIsSwitchDisabled(true);
    } else {
      setIsInverted(true);
      setIsSwitchDisabled(true);
    }
  }, [setIsInverted, selectedEntityId, selectedTag, entities]);

  return (
    <HoverCard>
      <HoverCardTrigger className="flex flex-col items-center justify-center space-y-1">
        <p className="text-sm">{!isInverted ? "Normal" : "Invertido"}</p>
        <Switch
          style={{
            backgroundColor: isInverted ? uiColor ?? "blue" : undefined,
          }}
          disabled={isSwitchDisabled}
          checked={isInverted}
          onCheckedChange={(bool) => setIsInverted(bool)}
        />
      </HoverCardTrigger>
      <HoverCardContent>
        <p className="font-semibold">Punto de vista</p>
        <p className="text-sm text-gray-700">
          La cuenta esta invertida para verlo desde el punto de vista de Maika y
          no de{" "}
          {selectedEntityId
            ? entities.find((obj) => obj.id === selectedEntityId)?.name
            : "la otra entidad"}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
};

export default InvertSwitch;
