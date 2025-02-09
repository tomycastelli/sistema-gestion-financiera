"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import React, { useEffect, useState, type FC } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/app/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/app/components/ui/form";
import AmountInput from "~/app/operaciones/carga/AmountInput";
import { numberFormatter, parseFormattedFloat } from "~/lib/functions";
import { currenciesOrder } from "~/lib/variables";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { Input } from "../components/ui/input";

const FormSchema = z.object({
  date: z.string(),
  rates: z.array(
    z.object({
      currency: z.string(),
      rate: z.string().nullish(),
    }),
  ),
});

interface UploadExchangesProps {
  initialCurrentDateRates: RouterOutputs["exchangeRates"]["getDateExchangeRates"];
}

const UploadExchanges: FC<UploadExchangesProps> = ({
  initialCurrentDateRates,
}) => {
  const today = new Date().toISOString().split("T")[0]!;
  const [date, setDate] = useState<string>(today);

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
        className="my-4 flex flex-col items-center justify-center gap-y-4"
      >
        <FormField
          control={control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="mb-1">Fecha</FormLabel>
              <div className="flex gap-2">
                <div className="flex flex-col">
                  <FormLabel className="text-xs">Día</FormLabel>
                  <Input
                    type="number"
                    className="w-16 rounded border px-2 py-1"
                    placeholder="DD"
                    min={1}
                    max={31}
                    value={
                      field.value
                        ? parseInt(field.value.split("-")[2] ?? "")
                        : ""
                    }
                    onChange={(e) => {
                      const [year, month] = field.value.split("-");
                      const day = e.target.value.padStart(2, "0");
                      const formattedDate = `${year}-${month}-${day}`;
                      field.onChange(formattedDate);
                      setDate(formattedDate);
                      if (e.target.value.length === 2) {
                        document
                          .querySelector<HTMLInputElement>(
                            'input[placeholder="MM"]',
                          )
                          ?.focus();
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col">
                  <FormLabel className="text-xs">Mes</FormLabel>
                  <Input
                    type="number"
                    className="w-16 rounded border px-2 py-1"
                    placeholder="MM"
                    min={1}
                    max={12}
                    value={
                      field.value
                        ? parseInt(field.value.split("-")[1] ?? "")
                        : ""
                    }
                    onChange={(e) => {
                      const [year, _, day] = field.value.split("-");
                      const month = e.target.value.padStart(2, "0");
                      const formattedDate = `${year}-${month}-${day}`;
                      field.onChange(formattedDate);
                      setDate(formattedDate);
                      if (e.target.value.length === 2) {
                        document
                          .querySelector<HTMLInputElement>(
                            'input[placeholder="YYYY"]',
                          )
                          ?.focus();
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col">
                  <FormLabel className="text-xs">Año</FormLabel>
                  <Input
                    type="number"
                    className="w-20 rounded border px-2 py-1"
                    placeholder="YYYY"
                    min={2000}
                    max={new Date().getFullYear()}
                    value={
                      field.value
                        ? parseInt(field.value.split("-")[0] ?? "")
                        : ""
                    }
                    onChange={(e) => {
                      const [_, month, day] = field.value.split("-");
                      const year = e.target.value.padStart(4, "0");
                      const formattedDate = `${year}-${month}-${day}`;
                      field.onChange(formattedDate);
                      setDate(formattedDate);
                    }}
                  />
                </div>
              </div>
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
