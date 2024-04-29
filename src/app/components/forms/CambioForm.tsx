"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "lucia";
import { useCallback, useEffect } from "react";
import { useForm, useWatch, useFieldArray, type UseFormReturn, type UseFieldArrayAppend, type UseFieldArrayRemove } from "react-hook-form";
import z from "zod";
import EntityCard from "~/app/components/ui/EntityCard";
import { Icons } from "~/app/components/ui/Icons";
import { numberFormatter, parseFormattedFloat } from "~/lib/functions";
import { currencies } from "~/lib/variables";
import {
  useTransactionsStore,
} from "~/stores/TransactionsStore";
import type { RouterOutputs } from "~/trpc/shared";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import CustomSelector from "./CustomSelector";
import { Label } from "../ui/label";
import { toast } from "sonner";
import AmountInput from "~/app/operaciones/carga/AmountInput";
import { useAutoAnimate } from "@formkit/auto-animate/react";

const FormSchema = z.object({
  transactions: z.array(
    z.object({
      entityA: z.string().min(1),
      entityB: z.string().min(1),
      entityOperator: z.string().min(1),
      currencyA: z.string().min(1),
      amountA: z.string().min(1),
      currencyB: z.string().min(1),
      amountB: z.string().min(1),
      exchangeRate: z.string().min(1),
      lockExchange: z.boolean().default(true),
      lockAmountA: z.boolean().default(true),
      lockAmountB: z.boolean().default(false),
      direction: z.boolean().default(true),
    }).refine(data => data.entityA !== data.entityB, {
      message: "Las entidades no pueden ser la misma",
      path: ['entityB']
    }))
});

interface OperationFormProps {
  user: User;
  entities: RouterOutputs["entities"]["getAll"];
  isLoading: boolean;
  mainTags: string[]
}

const CambioForm = ({ user, entities, mainTags }: OperationFormProps) => {
  const userEntityId = user
    ? entities?.find((obj) => obj.name === user.name)?.id
    : undefined;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      transactions: [{
        lockAmountA: true,
        lockAmountB: false,
        lockExchange: true,
        amountA: "",
        amountB: "",
        exchangeRate: ""
      }]
    }
  });

  const { handleSubmit, control, reset, setError } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "transactions",
  });

  const { addTransactionToStore } = useTransactionsStore()

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    for (const [index, value] of values.transactions.entries()) {
      if (value.entityA === value.entityB) {
        setError(
          `transactions.${index}.entityB`,
          {
            type: "pattern",
            message: "Las entidades de origen y destino no pueden ser iguales",
          },
          { shouldFocus: true },
        );
      }

      const entityAObj = entities.find(e => e.id === parseInt(value.entityA))!
      const entityBObj = entities.find(e => e.id === parseInt(value.entityB))!

      if (!mainTags.includes(entityAObj.tag.name) && !mainTags.includes(entityBObj.tag.name)) {
        toast.error(`Cambio ${index + 1}: ${entityAObj.name} - ${entityBObj.name}`, {
          description: `Aunque sea una de las entidades tiene que pertencer al tag: ${mainTags.join(", ")}`
        })
        return
      }

      const transactions = [
        {
          type: "cambio",
          fromEntityId: parseInt(value.entityA),
          toEntityId: parseInt(value.entityB),
          operatorId: parseInt(value.entityOperator),
          currency: value.currencyB,
          metadata: {
            exchangeRate: parseFormattedFloat(value.exchangeRate),
          },
          amount: parseFormattedFloat(value.amountB)
        },
        {
          type: "cambio",
          fromEntityId: parseInt(value.entityB),
          toEntityId: parseInt(value.entityA),
          operatorId: parseInt(value.entityOperator),
          currency: value.currencyA,
          metadata: {
            exchangeRate: parseFormattedFloat(value.exchangeRate),
          },
          amount: parseFormattedFloat(value.amountA),
        },
      ];

      transactions.forEach((transaction) => {
        addTransactionToStore(transaction);
      });

      reset({
        transactions: [{
          currencyA: "",
          currencyB: "",
          amountA: "",
          amountB: "",
          exchangeRate: "",
          lockAmountA: true,
          lockAmountB: false,
          lockExchange: true,
        }]
      });
    }
  };

  const [parent] = useAutoAnimate();

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-y-8 items-center justify-center"
        ref={parent}
      >
        {fields.map((field, index) => (
          <CambioPair remove={remove} append={append} key={field.id} index={index} form={form} entities={entities} userEntityId={userEntityId} />
        ))}
        <Button type="submit" className="mx-auto mt-6">
          <Icons.addPackage className="mr-2 h-5" />
          Añadir par de cambio
        </Button>
      </form>
    </Form>
  );
};

export default CambioForm;

interface CambioPairProps {
  index: number;
  entities: RouterOutputs["entities"]["getFiltered"]
  form: UseFormReturn<z.infer<typeof FormSchema>>;
  userEntityId: number | undefined;
  append: UseFieldArrayAppend<z.infer<typeof FormSchema>>;
  remove: UseFieldArrayRemove;
}

const CambioPair = ({ index, entities, form, userEntityId, append, remove }: CambioPairProps) => {
  const { watch, control, setValue } = form;

  const watchEntityA = useWatch({ name: `transactions.${index}.entityA`, control: control });
  const watchEntityB = useWatch({ name: `transactions.${index}.entityB`, control: control });
  const watchCurrencyA = watch(`transactions.${index}.currencyA`);
  const watchCurrencyB = watch(`transactions.${index}.currencyB`);
  const watchAmountA = watch(`transactions.${index}.amountA`);
  const watchAmountB = watch(`transactions.${index}.amountB`);
  const watchExchangeRate = watch(`transactions.${index}.exchangeRate`);
  const watchLockExchange = watch(`transactions.${index}.lockExchange`);
  const watchLockAmountA = watch(`transactions.${index}.lockAmountA`);
  const watchLockAmountB = watch(`transactions.${index}.lockAmountB`);

  const exchangeCalculation = useCallback(() => {
    const checkedCount = [watchLockAmountA, watchLockAmountB, watchLockExchange].filter(Boolean).length

    if (checkedCount > 2) {
      if (watchLockExchange) {
        setValue(`transactions.${index}.lockExchange`, false)
      } else if (watchLockAmountB) {
        setValue(`transactions.${index}.lockAmountB`, false)
      } else {
        setValue(`transactions.${index}.lockAmountA`, false)
      }
    }
    const isStrongCurrencyA = currencies.find(
      (obj) => obj.value === watchCurrencyA,
    )?.strong;
    const isStrongCurrencyB = currencies.find(
      (obj) => obj.value === watchCurrencyB,
    )?.strong;
    const amountA = parseFormattedFloat(watchAmountA);
    const amountB = parseFormattedFloat(watchAmountB);
    const exchangeRate = parseFormattedFloat(watchExchangeRate);
    if (watchCurrencyA && watchCurrencyB) {
      if (watchLockAmountA && amountA > 0 && watchLockAmountB && amountB > 0) {
        if (!isStrongCurrencyA && isStrongCurrencyB) {
          setValue(`transactions.${index}.exchangeRate`, numberFormatter(amountA / amountB));
        }
        if (isStrongCurrencyA && !isStrongCurrencyB) {
          setValue(`transactions.${index}.exchangeRate`, numberFormatter(amountB / amountA));
        }
        if (watchCurrencyA === "usd" && watchCurrencyB === "usdt") {
          setValue(
            `transactions.${index}.exchangeRate`,
            numberFormatter((amountB / amountA - 1) * 100),
          );
        }
        if (watchCurrencyA === "usdt" && watchCurrencyB === "usd") {
          setValue(
            `transactions.${index}.exchangeRate`,
            numberFormatter((amountA / amountB - 1) * 100),
          );
        }
      }
      if (
        watchLockAmountA &&
        amountA > 0 &&
        watchLockExchange &&
        (exchangeRate > 0 || exchangeRate < 0)
      ) {
        if (isStrongCurrencyA && !isStrongCurrencyB) {
          setValue(`transactions.${index}.amountB`, numberFormatter(amountA * exchangeRate));
        }
        if (!isStrongCurrencyA && isStrongCurrencyB) {
          setValue(`transactions.${index}.amountB`, numberFormatter(amountA / exchangeRate));
        }
        if (watchCurrencyA === "usd" && watchCurrencyB === "usdt") {
          setValue(
            `transactions.${index}.amountB`,
            numberFormatter(amountA / (1 + exchangeRate / 100)),
          );
        }
        if (watchCurrencyB === "usd" && watchCurrencyA === "usdt") {
          setValue(
            `transactions.${index}.amountB`,
            numberFormatter(amountA * (1 + exchangeRate / 100)),
          );
        }
      }
      if (
        watchLockAmountB &&
        amountB > 0 &&
        watchLockExchange &&
        (exchangeRate > 0 || exchangeRate < 0)
      ) {
        if (isStrongCurrencyA && !isStrongCurrencyB) {
          setValue(`transactions.${index}.amountA`, numberFormatter(amountB / exchangeRate));
        }
        if (!isStrongCurrencyA && isStrongCurrencyB) {
          setValue(`transactions.${index}.amountA`, numberFormatter(amountB * exchangeRate));
        }
        if (watchCurrencyA === "usdt" && watchCurrencyB === "usd") {
          setValue(
            `transactions.${index}.amountA`,
            numberFormatter(amountB * (exchangeRate / 100) + 1),
          );
        }
        if (watchCurrencyB === "usdt" && watchCurrencyA === "usd") {
          setValue(
            `transactions.${index}.amountA`,
            numberFormatter((amountB - 1) * (100 / exchangeRate)),
          );
        }
      }
    }
  }, [
    setValue,
    watchAmountA,
    watchAmountB,
    watchCurrencyA,
    watchCurrencyB,
    watchExchangeRate,
    watchLockAmountA,
    watchLockAmountB,
    watchLockExchange,
    index
  ]);

  useEffect(() => {
    exchangeCalculation();
  }, [exchangeCalculation]);

  return (
    <div className="flex flex-col items-center justify-center w-full gap-y-4">
      <div className="grid grid-cols-3">
        <div className="lg:justify-self-end">
          <FormField
            control={control}
            name={`transactions.${index}.entityA`}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Entidad</FormLabel>
                <CustomSelector
                  data={entities.map((entity) => ({
                    value: entity.id.toString(),
                    label: entity.name,
                  }))}
                  field={field}
                  fieldName={`transactions.${index}.entityA`}
                  placeholder="Elegir"
                />
                {watchEntityA && (
                  <EntityCard
                    disableLinks={true}
                    entity={
                      entities.find(
                        (obj) => obj.id.toString() === watchEntityA,
                      )!
                    }
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-4 flex flex-col space-y-2">
            <h1 className="mb-2 text-lg font-semibold">Entrada</h1>
            <Label>Divisa</Label>
            <FormField
              control={control}
              name={`transactions.${index}.currencyA`}
              render={({ field }) => (
                <FormItem>
                  <CustomSelector
                    data={currencies}
                    field={field}
                    fieldName={`transactions.${index}.currencyA`}
                    placeholder="Elegir"
                  />
                </FormItem>
              )}
            />
            <div className="flex flex-row items-end space-x-2">
              <AmountInput name={`transactions.${index}.amountA`} />
              <div className="flex flex-col space-y-1">
                <Icons.lock className="h-4 text-slate-900 dark:text-slate-100" />
                <FormField
                  control={control}
                  name={`transactions.${index}.lockAmountA`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="justify-self-center">
          <div className="flex h-full flex-col items-center justify-between">
            <div className="flex flex-col items-start space-y-2">
              <FormLabel>Operador</FormLabel>
              <FormField
                control={control}
                name={`transactions.${index}.entityOperator`}
                defaultValue={userEntityId?.toString()}
                render={({ field }) => (
                  <FormItem>
                    <CustomSelector
                      data={entities.map((entity) => ({
                        value: entity.id.toString(),
                        label: entity.name,
                      }))}
                      field={field}
                      fieldName={`transactions.${index}.entityOperator`}
                      placeholder="Elegir"
                    />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex flex-col mt-2 items-center justify-center space-y-6">
              <AmountInput
                placeholder={
                  ["usd", "usdt"].includes(watchCurrencyA) &&
                    ["usd", "usdt"].includes(watchCurrencyB) ? "%" : "$"
                }
                name={`transactions.${index}.exchangeRate`} label="Tipo de cambio" />
              <div className="flex flex-row items-center justify-center space-x-1">
                <Icons.lock className="h-4 text-slate-900 dark:text-slate-100" />
                <FormField
                  control={control}
                  name={`transactions.${index}.lockExchange`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="flex flex-col items-center space-y-4">
              <div className="flex flex-row items-center space-x-2">
                <Icons.arrowLeft className="h-8" />
                {!isNaN(parseFormattedFloat(watchAmountA)) && (
                  <h3 className="text-sm">
                    {numberFormatter(
                      parseFormattedFloat(watchAmountA),
                    )}
                  </h3>
                )}
                <h3 className="text-sm">{watchCurrencyA?.toUpperCase()}</h3>
              </div>
              <div className="flex flex-row items-center space-x-2">
                <h3 className="text-sm">{watchCurrencyB?.toUpperCase()}</h3>
                {!isNaN(parseFormattedFloat(watchAmountB)) && (
                  <h3 className="text-sm">
                    {numberFormatter(
                      parseFormattedFloat(watchAmountB),
                    )}
                  </h3>
                )}
                <Icons.arrowRight className="h-8" />
              </div>
            </div>
          </div>
        </div>
        <div className="lg:justify-self-start">
          <FormField
            control={control}
            name={`transactions.${index}.entityB`}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Entidad</FormLabel>
                <CustomSelector
                  data={entities.map((entity) => ({
                    value: entity.id.toString(),
                    label: entity.name,
                  }))}
                  field={field}
                  fieldName={`transactions.${index}.entityB`}
                  placeholder="Elegir"
                />
                {watchEntityB && (
                  <EntityCard
                    disableLinks={true}
                    entity={
                      entities.find(
                        (obj) => obj.id.toString() === watchEntityB,
                      )!
                    }
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-4 flex flex-col space-y-2">
            <h1 className="mb-2 text-lg font-semibold">Salida</h1>
            <Label>Divisa</Label>
            <FormField
              control={control}
              name={`transactions.${index}.currencyB`}
              render={({ field }) => (
                <FormItem>
                  <CustomSelector
                    data={currencies}
                    field={field}
                    fieldName={`transactions.${index}.currencyB`}
                    placeholder="Elegir"
                  />
                </FormItem>
              )}
            />
            <div className="flex flex-row items-end space-x-2">
              <AmountInput name={`transactions.${index}.amountB`} />
              <div className="flex flex-col space-y-1">
                <Icons.lock className="h-4 text-slate-900 dark:text-slate-100" />
                <FormField
                  control={control}
                  name={`transactions.${index}.lockAmountB`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-row gap-x-2 justify-center items-center">
        <Button type="button" variant="outline" className="border-transparent" onClick={() => append({
          lockAmountA: true,
          lockAmountB: false,
          lockExchange: true,
          amountA: "",
          amountB: "",
          exchangeRate: "",
          currencyA: "",
          currencyB: "",
          direction: true,
          entityOperator: watch(`transactions.${index}.entityOperator`),
          entityA: watch(`transactions.${index}.entityB`),
          entityB: watch(`transactions.${index}.entityA`)
        })}>
          <Icons.addPackage className="text-green h-5" />
        </Button>
        {index > 0 && (
          <Button
            type="button"
            className="border-transparent"
            onClick={() => remove(index)}
            variant="outline"
          >
            <Icons.removePackage className="h-6 text-red" />
          </Button>
        )}
      </div>
    </div>
  )
}
