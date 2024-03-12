"use client";

import * as React from "react";

import { CalendarIcon } from "lucide-react";
import moment from "moment";
import { Button } from "~/app/components/ui/button";
import { Calendar } from "~/app/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/components/ui/popover";
import { cn } from "~/lib/utils";
import { dateFormatting } from "~/lib/variables";
import { useCuentasStore } from "~/stores/cuentasStore";

export function TimeMachine() {
  const { timeMachineDate, setTimeMachineDate } = useCuentasStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !timeMachineDate && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {timeMachineDate ? (
            moment(timeMachineDate).format(dateFormatting.day)
          ) : (
            <span>Viajar al pasado</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={timeMachineDate}
          onSelect={setTimeMachineDate}
          disabled={(date) => date > new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
