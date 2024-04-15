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
import { dateFormatting } from "~/lib/variables";
import { useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";


const TimeMachine = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname()

  const timeMachineDate = searchParams.get("dia") ?? undefined;

  const parsedDate = timeMachineDate ? moment(timeMachineDate, dateFormatting.day).toDate() : undefined

  const router = useRouter()

  const setTimeMachineDate = useCallback((dateInput: Date | undefined) => {
    const updatedSearchParams = new URLSearchParams(searchParams)

    const dateString = dateInput ? moment(dateInput).format(dateFormatting.day) : undefined

    if (dateString) {
      updatedSearchParams.set("dia", dateString)
    } else {
      updatedSearchParams.delete("dia")
    }

    router.push(pathname + "?" + updatedSearchParams.toString())
  }, [router, pathname, searchParams])

  useEffect(() => {
    if (timeMachineDate) {
      setTimeMachineDate(moment(timeMachineDate, dateFormatting.day).toDate())
    }
  }, [router, timeMachineDate, setTimeMachineDate])

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
          {timeMachineDate ?? "Viajar al pasado"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          onSelect={setTimeMachineDate}
          disabled={(date) => date > moment().toDate()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default TimeMachine
