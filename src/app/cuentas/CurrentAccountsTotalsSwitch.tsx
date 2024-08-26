"use client";

import { useCuentasStore } from "~/stores/cuentasStore";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";

const CurrentAccountsTotalsSwitch = () => {
  const { showCurrentAccountTotals, setShowCurrentAccountsTotals } =
    useCuentasStore();

  return (
    <div className="flex flex-col items-center justify-start gap-y-1">
      <Label>Mostrar totales</Label>
      <Switch
        checked={showCurrentAccountTotals}
        onCheckedChange={setShowCurrentAccountsTotals}
      />
    </div>
  );
};

export default CurrentAccountsTotalsSwitch;
