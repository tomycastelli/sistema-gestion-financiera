"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { getCurrentTime } from "~/lib/functions";
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

const InitialDataOperationForm = () => {
  const FormSchema = InitialOperationStoreSchema;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      opDate: new Date(),
      opTime: getCurrentTime(),
    },
  });

  const { handleSubmit, control } = form;

  const {
    setIsInitialOperationSubmitted,
    setInitialOperationStore,
    initialOperationStore,
  } = useInitialOperationStore();

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    setInitialOperationStore({
      opDate: values.opDate,
      opTime: values.opTime ? values.opTime : getCurrentTime(),
      opObservations: values.opObservations,
    });
    setIsInitialOperationSubmitted(true);

    console.log(
      `Single operation submited to state: ${JSON.stringify(
        initialOperationStore,
      )}`,
    );
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
                          field.value.toLocaleDateString("es-AR")
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
                        date > new Date() || date < new Date("2023-01-01")
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
                    defaultValue={getCurrentTime()}
                    className="w-[72px]"
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
