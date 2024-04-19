"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import moment from "moment";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { cn } from "~/lib/utils";
import {
  InitialOperationStoreSchema,
  useInitialOperationStore,
} from "~/stores/InitialOperationStore";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Textarea } from "../ui/textarea";
import { getAccountingPeriodDate } from "~/lib/functions";
import { type RouterOutputs } from "~/trpc/shared";
import { type FC } from "react";

interface InitialDataOperationFormProps {
  accountingPeriodData: RouterOutputs["globalSettings"]["get"]["data"];
}

const InitialDataOperationForm: FC<InitialDataOperationFormProps> = ({ accountingPeriodData }) => {
  const FormSchema = InitialOperationStoreSchema;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      opDate: new Date(),
      opTime: moment().format("HH:mm"),
    },
  });

  const { handleSubmit, control } = form;

  const accountingPeriod = accountingPeriodData as { months: number; graceDays: number; }

  const accountingPeriodDate = getAccountingPeriodDate(accountingPeriod.months, accountingPeriod.graceDays)

  const { setIsInitialOperationSubmitted, setInitialOperationStore } =
    useInitialOperationStore();

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    setInitialOperationStore({
      opDate: values.opDate,
      opTime: values.opTime ? values.opTime : moment().format("HH:mm"),
      opObservations: values.opObservations,
    });
    setIsInitialOperationSubmitted(true);
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight">
          Nueva operación
        </h1>
        <div className="flex flex-row items-end space-x-2">
          <FormField
            control={control}
            defaultValue={new Date()}
            name="opDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="mb-1">Fecha</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[120px] bg-transparent pl-3 text-left font-normal hover:bg-transparent",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? (
                          moment(field.value).format("DD-MM-YYYY")
                        ) : (
                          <span>Elegir</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < accountingPeriodDate ||
                        date > moment().startOf("day").toDate()
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="opTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tiempo</FormLabel>
                <FormControl>
                  <Input
                    className="w-[88px]"
                    type="time"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="opObservations"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observaciones</FormLabel>
              <FormControl>
                <Textarea className="resize-none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Continuar</Button>
      </form>
    </Form>
  );
};

export default InitialDataOperationForm;
