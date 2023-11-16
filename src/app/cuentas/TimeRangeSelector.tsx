"use client";

import { useCuentasStore } from "~/stores/cuentasStore";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const TimeRangeSelector = () => {
  const { selectedTimeframe, setTimeframe } = useCuentasStore();

  return (
    <Select onValueChange={setTimeframe} value={selectedTimeframe}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Elegir rango de tiempo" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="daily">Diario</SelectItem>
          <SelectItem value="weekly">Semanal</SelectItem>
          <SelectItem value="monthly">Mensual</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default TimeRangeSelector;
