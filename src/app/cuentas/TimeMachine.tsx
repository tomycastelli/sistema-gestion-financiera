"use client";

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
import { useCuentasStore } from "~/stores/cuentasStore";

const TimeMachine = () => {
  const { dayInPast, setDayInPast } = useCuentasStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !dayInPast && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dayInPast || "Viajar en el tiempo"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={
            dayInPast
              ? moment(dayInPast, "DD-MM-YYYY").startOf("day").toDate()
              : undefined
          }
          onSelect={(date) => {
            if (!date) {
              setDayInPast(undefined);
              return;
            }

            const currentFormatted = dayInPast;
            const newFormatted = moment(date)
              .startOf("day")
              .format("DD-MM-YYYY");

            if (currentFormatted === newFormatted) {
              setDayInPast(undefined);
            } else {
              setDayInPast(newFormatted);
            }
          }}
          disabled={(date) => date > moment().startOf("day").toDate()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

export default TimeMachine;
