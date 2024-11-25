"use client";

import React, { useEffect, type FC } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import moment from "moment";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "~/app/components/ui/form";
import { currenciesOrder, dateFormat } from "~/lib/variables";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/components/ui/popover";
import { Button } from "~/app/components/ui/button";
import { Calendar } from "~/app/components/ui/calendar";
import AmountInput from "~/app/operaciones/carga/AmountInput";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { numberFormatter, parseFormattedFloat } from "~/lib/functions";
import { parseAsString, useQueryState } from "nuqs";
import { type RouterOutputs } from "~/trpc/shared";

const FormSchema = z.object({
  date: z.date(),
  rates: z.array(
    z.object({
      currency: z.string(),
      rate: z.string().nullish(),
    }),
  ),
});

interface UploadExhchangesProps {
  list: {
    page: number;
    filterCurrency: string | undefined;
  };
  initialCurrentDateRates: RouterOutputs["exchangeRates"]["getAllExchangeRates"];
}

const UploadExchanges: FC<UploadExhchangesProps> = ({
  list,
  initialCurrentDateRates,
}) => {
  const [date, setDate] = useQueryState(
    "fecha",
    parseAsString.withDefault(moment().format("DD-MM-YYYY")),
  );

  const parsedDate = moment(date, dateFormat).toDate();

  const { data: currentDateExchangeRates } =
    api.exchangeRates.getDateExchangeRates.useQuery(
      {
        date: parsedDate,
      },
      {
        initialData: initialCurrentDateRates,
      },
    );

  const form = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      date: parsedDate,
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
      reset();
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
    async onMutate(newOperation) {
      // Doing the Optimistic update
      await utils.exchangeRates.getAllExchangeRates.cancel();

      const prevData = utils.exchangeRates.getAllExchangeRates.getData();

      utils.exchangeRates.getAllExchangeRates.setData(
        {
          page: list.page,
          currency: list.filterCurrency,
        },
        (old) => [
          ...newOperation,
          ...old!.slice(0, old!.length - newOperation.length),
        ],
      );

      return { prevData };
    },
    onError(err, _, ctx) {
      utils.exchangeRates.getAllExchangeRates.setData(
        {
          page: list.page,
          currency: list.filterCurrency,
        },
        ctx?.prevData,
      );

      toast.error("No se pudieron añadir los tipos de cambio", {
        description: JSON.stringify(err.message),
      });
    },
    onSettled() {
      void utils.exchangeRates.getAllExchangeRates.invalidate();
    },
    onSuccess(_, variables) {
      const isMultiple = variables.length > 1;
      toast.success(
        `${variables.length} tipo${isMultiple && "s"} de cambio añadido${
          isMultiple && "s"
        }`,
      );
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
    const onlyDate = moment(values.date).startOf("day").toDate();
    await mutateAsync(
      filteredRates.map((r) => ({
        date: onlyDate,
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
                    selected={field.value}
                    onSelect={(value) => {
                      field.onChange(value);
                      if (value) {
                        void setDate(moment(value).format("DD-MM-YYYY"));
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
