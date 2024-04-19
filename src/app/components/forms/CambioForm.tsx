"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "lucia";
import { useCallback, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import z from "zod";
import EntityCard from "~/app/components/ui/EntityCard";
import { Icons } from "~/app/components/ui/Icons";
import { numberFormatter, parseFormattedFloat } from "~/lib/functions";
import { currencies } from "~/lib/variables";
import {
  useTransactionsStore,
  type SingleTransactionInStoreSchema,
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
import { Input } from "../ui/input";
import CustomSelector from "./CustomSelector";
import { useNumberFormat } from "@react-input/number-format";
import { Label } from "../ui/label";
import { toast } from "sonner";

const FormSchema = z.object({
  entityA: z.string().min(1),
  entityB: z.string().min(1),
  entityOperator: z.string().min(1),
  currencyA: z.string().min(1),
  amountA: z.string().min(1),
  methodA: z.string().optional(),
  currencyB: z.string().min(1),
  amountB: z.string().min(1),
  methodB: z.string().optional(),
  exchangeRate: z.string().min(1),
  lockExchange: z.boolean().default(true),
  lockAmountA: z.boolean().default(true),
  lockAmountB: z.boolean().default(false),
  direction: z.boolean().default(true),
}).refine(data => data.entityA !== data.entityB, {
  message: "Las entidades no pueden ser la misma",
  path: ['entityB']
});

interface OperationFormProps {
  user: User;
  entities: RouterOutputs["entities"]["getAll"];
  isLoading: boolean;
  mainTags: string[]
}

const CambioForm = ({ user, entities, isLoading, mainTags }: OperationFormProps) => {
  const userEntityId = user
    ? entities?.find((obj) => obj.name === user.name)?.id
    : undefined;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      lockAmountA: true,
      lockAmountB: false,
      lockExchange: true,
      amountA: "",
      amountB: "",
      exchangeRate: ""
    },
  });

  const { handleSubmit, watch, control, setValue, reset, setError } = form;

  const watchEntityA = useWatch({ name: "entityA", control: control });
  const watchEntityB = useWatch({ name: "entityB", control: control });
  const watchCurrencyA = watch("currencyA");
  const watchCurrencyB = watch("currencyB");
  const watchAmountA = watch("amountA");
  const watchAmountB = watch("amountB");
  const watchExchangeRate = watch("exchangeRate");
  const watchLockExchange = watch("lockExchange");
  const watchLockAmountA = watch("lockAmountA");
  const watchLockAmountB = watch("lockAmountB");

  const { addTransactionToStore } = useTransactionsStore();

  const exchangeCalculation = useCallback(() => {
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
          setValue("exchangeRate", numberFormatter(amountA / amountB));
        }
        if (isStrongCurrencyA && !isStrongCurrencyB) {
          setValue("exchangeRate", numberFormatter(amountB / amountA));
        }
        if (watchCurrencyA === "usd" && watchCurrencyB === "usdt") {
          setValue(
            "exchangeRate",
            numberFormatter((amountB / amountA - 1) * 100),
          );
        }
        if (watchCurrencyA === "usdt" && watchCurrencyB === "usd") {
          setValue(
            "exchangeRate",
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
          setValue("amountB", numberFormatter(amountA * exchangeRate));
        }
        if (!isStrongCurrencyA && isStrongCurrencyB) {
          setValue("amountB", numberFormatter(amountA / exchangeRate));
        }
        if (watchCurrencyA === "usd" && watchCurrencyB === "usdt") {
          setValue(
            "amountB",
            numberFormatter(amountA / (1 + exchangeRate / 100)),
          );
        }
        if (watchCurrencyB === "usd" && watchCurrencyA === "usdt") {
          setValue(
            "amountB",
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
          setValue("amountA", numberFormatter(amountB / exchangeRate));
        }
        if (!isStrongCurrencyA && isStrongCurrencyB) {
          setValue("amountA", numberFormatter(amountB * exchangeRate));
        }
        if (watchCurrencyA === "usdt" && watchCurrencyB === "usd") {
          setValue(
            "amountA",
            numberFormatter(amountB * (exchangeRate / 100) + 1),
          );
        }
        if (watchCurrencyB === "usdt" && watchCurrencyA === "usd") {
          setValue(
            "amountA",
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
  ]);

  useEffect(() => {
    exchangeCalculation();
  }, [exchangeCalculation]);

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    if (values.entityA === values.entityB) {
      setError(
        "entityB",
        {
          type: "pattern",
          message: "Las entidades de origen y destino no pueden ser iguales",
        },
        { shouldFocus: true },
      );
    }

    const entityATag = entities.find(e => e.id === parseInt(values.entityA))!.tag.name
    const entityBTag = entities.find(e => e.id === parseInt(values.entityB))!.tag.name

    console.log("Entidades A y B tags: ", entityBTag, entityATag)

    if (!mainTags.includes(entityATag) && !mainTags.includes(entityBTag)) {
      toast.error(`Aunque sea una de las entidades tiene que pertencer al tag: ${mainTags.join(", ")}`)
      return
    }

    const transactions: SingleTransactionInStoreSchema[] = [
      {
        txId: 0,
        type: "cambio",
        fromEntityId: parseInt(values.entityA),
        toEntityId: parseInt(values.entityB),
        operatorId: parseInt(values.entityOperator),
        currency: values.currencyB,
        metadata: {
          exchangeRate: parseFormattedFloat(values.exchangeRate),
        },
        amount: parseFormattedFloat(values.amountB)
      },
      {
        txId: 0,
        type: "cambio",
        fromEntityId: parseInt(values.entityB),
        toEntityId: parseInt(values.entityA),
        operatorId: parseInt(values.entityOperator),
        currency: values.currencyA,
        metadata: {
          exchangeRate: parseFormattedFloat(values.exchangeRate),
        },
        amount: parseFormattedFloat(values.amountA),
      },
    ];

    transactions.forEach((transaction) => {
      addTransactionToStore(transaction);
    });

    reset({
      currencyA: "",
      currencyB: "",
      amountA: "",
      amountB: "",
      methodA: "",
      methodB: "",
      exchangeRate: "",
      lockAmountA: true,
      lockAmountB: false,
      lockExchange: true,
    });
  };

  const inputRef1 = useNumberFormat({ locales: "es-AR" })
  const inputRef2 = useNumberFormat({ locales: "es-AR" })
  const inputRef3 = useNumberFormat({ locales: "es-AR" })

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col justify-center"
      >
        <div className="grid grid-cols-3">
          <div className="lg:justify-self-end">
            <FormField
              control={control}
              name="entityA"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Entidad</FormLabel>
                  {entities ? (
                    <>
                      <CustomSelector
                        data={entities.map((entity) => ({
                          value: entity.id.toString(),
                          label: entity.name,
                        }))}
                        field={field}
                        fieldName="entityA"
                        placeholder="Elegir"
                        isLoading={isLoading}
                      />
                      {watchEntityA && (
                        <EntityCard
                          entity={
                            entities.find(
                              (obj) => obj.id.toString() === watchEntityA,
                            )!
                          }
                        />
                      )}
                    </>
                  ) : (
                    isLoading && <p>Cargando...</p>
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
                name="currencyA"
                render={({ field }) => (
                  <FormItem>
                    <CustomSelector
                      data={currencies}
                      field={field}
                      fieldName="currencyA"
                      placeholder="Elegir"
                    />
                  </FormItem>
                )}
              />
              <div className="flex flex-row items-end space-x-2">
                <FormField
                  control={control}
                  name="amountA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input ref={inputRef1} className="w-32" name={field.name} placeholder="$"
                          value={field.value}
                          onChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex flex-col space-y-1">
                  <Icons.lock className="h-4 text-slate-900" />
                  <FormField
                    control={control}
                    name="lockAmountA"
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
                  name="entityOperator"
                  defaultValue={userEntityId?.toString()}
                  render={({ field }) => (
                    <FormItem>
                      {entities ? (
                        <>
                          <CustomSelector
                            data={entities.map((entity) => ({
                              value: entity.id.toString(),
                              label: entity.name,
                            }))}
                            field={field}
                            fieldName="entityOperator"
                            placeholder="Elegir"
                            isLoading={isLoading}
                          />
                        </>
                      ) : (
                        isLoading && <p>Cargando...</p>
                      )}
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex flex-col mt-2 items-center justify-center space-y-6">
                <FormField
                  control={control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de cambio</FormLabel>
                      <FormControl>
                        <Input ref={inputRef2} className="w-32" name={field.name} placeholder="$"
                          value={field.value}
                          onChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex flex-row items-center justify-center space-x-1">
                  <Icons.lock className="h-4 text-slate-900" />
                  <FormField
                    control={control}
                    name="lockExchange"
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
              name="entityB"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Entidad</FormLabel>
                  {entities ? (
                    <>
                      <CustomSelector
                        data={entities.map((entity) => ({
                          value: entity.id.toString(),
                          label: entity.name,
                        }))}
                        field={field}
                        fieldName="entityB"
                        placeholder="Elegir"
                        isLoading={isLoading}
                      />
                      {watchEntityB && (
                        <EntityCard
                          entity={
                            entities.find(
                              (obj) => obj.id.toString() === watchEntityB,
                            )!
                          }
                        />
                      )}
                    </>
                  ) : (
                    isLoading && <p>Cargando...</p>
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
                name="currencyB"
                render={({ field }) => (
                  <FormItem>
                    <CustomSelector
                      data={currencies}
                      field={field}
                      fieldName="currencyB"
                      placeholder="Elegir"
                    />
                  </FormItem>
                )}
              />
              <div className="flex flex-row items-end space-x-2">
                <FormField
                  control={control}
                  name="amountB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input ref={inputRef3} className="w-32" name={field.name} placeholder="$"
                          value={field.value}
                          onChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex flex-col space-y-1">
                  <Icons.lock className="h-4 text-slate-900" />
                  <FormField
                    control={control}
                    name="lockAmountB"
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
        <Button type="submit" className="mx-auto mt-6">
          <Icons.addPackage className="mr-2 h-5" />
          Añadir par de cambio
        </Button>
      </form>
    </Form>
  );
};

export default CambioForm;

