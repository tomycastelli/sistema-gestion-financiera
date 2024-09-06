"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import moment from "moment";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cn } from "~/lib/utils";
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
import { type FC } from "react";
import { useTransactionsStore } from "~/stores/TransactionsStore";
import { Switch } from "../ui/switch";

interface InitialDataOperationFormProps {
  accountingPeriodDate: Date;
}

const InitialDataOperationForm: FC<InitialDataOperationFormProps> = ({
  accountingPeriodDate,
}) => {
  const FormSchema = z.object({
    dateMode: z.enum(["now", "custom"]),
    opDate: z.date(),
    opTime: z.string(),
    observations: z.string(),
  });

  const {
    setOpDate,
    setObservations,
    setIsInitialDataSubmitted,
    opDate,
    observations,
  } = useTransactionsStore();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      opDate: opDate.date === "now" ? new Date() : opDate.data.opDate,
      opTime:
        opDate.date === "now" ? moment().format("HH:mm") : opDate.data.opTime,
      observations,
      dateMode: opDate.date,
    },
  });

  const { handleSubmit, control, watch } = form;

  const watchDateMode = watch("dateMode");

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    setObservations(values.observations);
    if (values.dateMode === "now") {
      setOpDate({ date: "now" });
    } else {
      setOpDate({
        date: "custom",
        data: {
          opDate: values.opDate,
          opTime: values.opTime ? values.opTime : moment().format("HH:mm"),
        },
      });
    }
    setIsInitialDataSubmitted(true);
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          Nueva operación
        </h1>
        <div className="flex flex-col justify-start gap-y-2">
          <FormField
            control={control}
            name="dateMode"
            defaultValue="now"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="mb-1">Ahora</FormLabel>
                <Switch
                  checked={field.value === "now"}
                  onCheckedChange={(checked) =>
                    form.setValue("dateMode", checked ? "now" : "custom")
                  }
                />
                <FormMessage />
              </FormItem>
            )}
          />
          {watchDateMode === "custom" && (
            <div className="flex flex-row items-end gap-x-2">
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
                      <Input className="w-[107px]" type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
        <FormField
          control={form.control}
          name="observations"
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
