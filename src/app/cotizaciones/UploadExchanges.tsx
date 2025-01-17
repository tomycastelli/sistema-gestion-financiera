"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import moment from "moment";
import React, { useEffect, useState, type FC } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/app/components/ui/button";
import { Calendar } from "~/app/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/app/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/components/ui/popover";
import AmountInput from "~/app/operaciones/carga/AmountInput";
import { numberFormatter, parseFormattedFloat } from "~/lib/functions";
import { currenciesOrder } from "~/lib/variables";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

const FormSchema = z.object({
  date: z.string(),
  rates: z.array(
    z.object({
      currency: z.string(),
      rate: z.string().nullish(),
    }),
  ),
});

interface UploadExhchangesProps {
  initialCurrentDateRates: RouterOutputs["exchangeRates"]["getAllExchangeRates"];
}

const UploadExchanges: FC<UploadExhchangesProps> = ({
  initialCurrentDateRates,
}) => {
  const [date, setDate] = useState<string>(moment().format("YYYY-MM-DD"));

  const { data: currentDateExchangeRates } =
    api.exchangeRates.getDateExchangeRates.useQuery(
      {
        date,
      },
      {
        initialData: initialCurrentDateRates,
      },
    );

  const form = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      date,
      rates: currenciesOrder
        .filter((c) => c !== "usd")
        .map((currency) => {
          const currentRate = currentDateExchangeRates.find(
            (r) => r.currency === currency,
          );
          return {
            currency,
            rate: currentRate ? numberFormatter(currentRate?.rate) : undefined,
          };
        }),
    },
  });

  const { handleSubmit, control, reset } = form;

  useEffect(() => {
    if (currentDateExchangeRates.length === 0) {
      reset({
        date: form.getValues("date"),
        rates: currenciesOrder
          .filter((c) => c !== "usd")
          .map((currency) => ({
            currency,
            rate: undefined,
          })),
      });
      return;
    }
    form.setValue(
      "rates",
      currenciesOrder
        .filter((c) => c !== "usd")
        .map((currency) => {
          const currentRate = currentDateExchangeRates.find(
            (r) => r.currency === currency,
          );
          return {
            currency,
            rate: currentRate ? numberFormatter(currentRate?.rate) : undefined,
          };
        }),
    );
  }, [currentDateExchangeRates, form, reset]);

  const { fields } = useFieldArray({
    control,
    name: "rates",
  });

  const utils = api.useContext();

  const { mutateAsync } = api.exchangeRates.addExchangeRates.useMutation({
    onError(err) {
      toast.error("No se pudieron añadir los tipos de cambio", {
        description: JSON.stringify(err.message),
      });
    },
    onSuccess(_, variables) {
      const isMultiple = variables.length > 1;
      toast.success(
        `${variables.length} tipo${isMultiple ? "s" : ""} de cambio añadido${
          isMultiple ? "s" : ""
        }`,
      );
      void utils.exchangeRates.getAllExchangeRates.invalidate();
      void utils.exchangeRates.getDateExchangeRates.invalidate();
    },
  });

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    const filteredRates = values.rates.filter(
      (r) => typeof r.rate === "string",
    );
    if (filteredRates.length === 0) {
      toast.warning("Se necesita un tipo de cambio como mínimo");
      return;
    }
    await mutateAsync(
      filteredRates.map((r) => ({
        date: values.date,
        currency: r.currency,
        rate: parseFormattedFloat(r.rate!),
      })),
    );

    reset();
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col items-center justify-center gap-y-4"
      >
        <FormField
          control={control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="mb-1">Fecha</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant={"outline"}
                      className={`w-[120px] bg-transparent pl-3 text-left font-normal hover:bg-transparent ${
                        !field.value && "text-muted-foreground"
                      }`}
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
                    selected={moment(field.value, "YYYY-MM-DD").toDate()}
                    onSelect={(value) => {
                      if (value) {
                        const formattedDate =
                          moment(value).format("YYYY-MM-DD");
                        field.onChange(formattedDate);
                        setDate(formattedDate);
                      } else {
                        const today = moment().format("YYYY-MM-DD");
                        field.onChange(today);
                        setDate(today);
                      }
                    }}
                    disabled={(date) => date > moment().startOf("day").toDate()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 grid-rows-2 gap-4">
          {fields.map((field, index) => (
            <div key={field.id}>
              <AmountInput
                decimals={field.currency === "usdt" ? 4 : 2}
                placeholder={field.currency === "usdt" ? "%" : "$"}
                name={`rates.${index}.rate`}
                label={field.currency.toUpperCase()}
              />
            </div>
          ))}
        </div>
        <Button type="submit">Subir</Button>
      </form>
    </Form>
  );
};

export default UploadExchanges;
