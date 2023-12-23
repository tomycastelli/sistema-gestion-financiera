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
          <SelectItem value="day">Diario</SelectItem>
          <SelectItem value="week">Semanal</SelectItem>
          <SelectItem value="month">Mensual</SelectItem>
          <SelectItem value="year">Anual</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default TimeRangeSelector;
