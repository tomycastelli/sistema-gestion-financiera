"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "next-auth";
import { useCallback, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import z from "zod";
import EntityCard from "~/app/components/ui/EntityCard";
import { Icons } from "~/app/components/ui/Icons";
import { isNumeric } from "~/lib/functions";
import { currencies, paymentMethods } from "~/lib/variables";
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

const FormSchema = z.object({
  entityA: z.string().min(1),
  entityB: z.string().min(1),
  entityOperator: z.string().min(1),
  currencyA: z.string().min(1),
  amountA: z
    .string()
    .refine((value) => value === undefined || isNumeric(value), {
      message: "Tiene que ser un valor númerico",
    }),
  methodA: z.string().optional(),
  currencyB: z.string().min(1),
  amountB: z
    .string()
    .refine((value) => value === undefined || isNumeric(value), {
      message: "Tiene que ser un valor númerico",
    }),
  methodB: z.string().optional(),
  exchangeRate: z
    .string()
    .refine((value) => value === undefined || isNumeric(value), {
      message: "Tiene que ser un valor númerico",
    }),
  lockExchange: z.boolean().default(true),
  lockAmountA: z.boolean().default(true),
  lockAmountB: z.boolean().default(false),
  direction: z.boolean().default(true),
});

interface OperationFormProps {
  user: User;
  entities: RouterOutputs["entities"]["getAll"];
  isLoading: boolean;
}

const CambioForm = ({ user, entities, isLoading }: OperationFormProps) => {
  const userEntityId = user
    ? entities?.find((obj) => obj.name === user.name)?.id
    : null;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      lockAmountA: true,
      lockAmountB: false,
      lockExchange: true,
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
    const amountA = parseFloat(watchAmountA);
    const amountB = parseFloat(watchAmountB);
    const exchangeRate = parseFloat(watchExchangeRate);
    if (watchCurrencyA && watchCurrencyB) {
      if (watchLockAmountA && amountA > 0 && watchLockAmountB && amountB > 0) {
        if (!isStrongCurrencyA && isStrongCurrencyB) {
          setValue("exchangeRate", (amountA / amountB).toFixed(2).toString());
        }
        if (isStrongCurrencyA && !isStrongCurrencyB) {
          setValue("exchangeRate", (amountB / amountA).toFixed(2).toString());
        }
        if (watchCurrencyA === "usd" && watchCurrencyB === "usdt") {
          setValue(
            "exchangeRate",
            ((amountB / amountA - 1) * 100).toFixed(4).toString(),
          );
        }
        if (watchCurrencyA === "usdt" && watchCurrencyB === "usd") {
          setValue(
            "exchangeRate",
            ((amountA / amountB - 1) * 100).toFixed(4).toString(),
          );
        }
      }
      if (
        watchLockAmountA &&
        amountA > 0 &&
        watchLockExchange &&
        exchangeRate > 0
      ) {
        if (isStrongCurrencyA && !isStrongCurrencyB) {
          setValue("amountB", (amountA * exchangeRate).toFixed(2).toString());
        }
        if (!isStrongCurrencyA && isStrongCurrencyB) {
          setValue("amountB", (amountA / exchangeRate).toFixed(2).toString());
        }
        if (watchCurrencyA === "usd" && watchCurrencyB === "usdt") {
          setValue(
            "amountB",
            (amountA * (exchangeRate / 100) + 1).toFixed(4).toString(),
          );
        }
        if (watchCurrencyB === "usd" && watchCurrencyA === "usdt") {
          setValue(
            "amountB",
            ((amountA - 1) * (100 / exchangeRate)).toFixed(4).toString(),
          );
        }
      }
      if (
        watchLockAmountB &&
        amountB > 0 &&
        watchLockExchange &&
        exchangeRate > 0
      ) {
        if (isStrongCurrencyA && !isStrongCurrencyB) {
          setValue("amountA", (amountB / exchangeRate).toFixed(2).toString());
        }
        if (!isStrongCurrencyA && isStrongCurrencyB) {
          setValue("amountA", (amountB * exchangeRate).toFixed(2).toString());
        }
        if (watchCurrencyA === "usdt" && watchCurrencyB === "usd") {
          setValue(
            "amountA",
            (amountB * (exchangeRate / 100) + 1).toFixed(4).toString(),
          );
        }
        if (watchCurrencyB === "usdt" && watchCurrencyA === "usd") {
          setValue(
            "amountA",
            ((amountB - 1) * (100 / exchangeRate)).toFixed(4).toString(),
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
    if (!isNumeric(values.amountA)) {
      setError("amountA", {
        type: "validate",
        message: "El monto solo puede contener numeros",
      });
    }
    if (!isNumeric(values.amountB)) {
      setError("amountB", {
        type: "validate",
        message: "El monto solo puede contener numeros",
      });
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
          exchangeRate: parseFloat(values.exchangeRate),
        },
        amount: parseFloat(values.amountB),
      },
      {
        txId: 0,
        type: "cambio",
        fromEntityId: parseInt(values.entityB),
        toEntityId: parseInt(values.entityA),
        operatorId: parseInt(values.entityOperator),
        currency: values.currencyA,
        metadata: {
          exchangeRate: parseFloat(values.exchangeRate),
        },
        amount: parseFloat(values.amountA),
      },
    ];

    transactions.forEach((transaction) => {
      addTransactionToStore(transaction);
      console.log(`Added transaction to store: ${JSON.stringify(transaction)}`);
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
              <FormField
                control={control}
                name="currencyA"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Divisa</FormLabel>
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
                        <Input className="w-32" placeholder="$" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex flex-col space-y-1">
                  <Icons.lock className="h-4 text-slate-900" />
                  <FormField
                    control={form.control}
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
              <FormField
                control={control}
                name="methodA"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método</FormLabel>
                    <CustomSelector
                      data={paymentMethods}
                      field={field}
                      fieldName="methodA"
                      placeholder="Elegir"
                    />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="justify-self-center">
            <div className="flex h-full flex-col items-center justify-between">
              <div className="flex flex-col items-center space-y-2">
                <FormField
                  control={control}
                  name="entityOperator"
                  defaultValue={userEntityId?.toString()}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operador</FormLabel>
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
              <div className="flex flex-col items-center justify-center space-y-6">
                <FormField
                  control={control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de cambio</FormLabel>
                      <FormControl>
                        <Input className="w-32" placeholder="$" {...field} />
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
                  {!isNaN(parseFloat(watchAmountA)) && (
                    <h3 className="text-sm">{watchAmountA}</h3>
                  )}
                  <h3 className="text-sm">{watchCurrencyA?.toUpperCase()}</h3>
                </div>
                <div className="flex flex-row items-center space-x-2">
                  <h3 className="text-sm">{watchCurrencyB?.toUpperCase()}</h3>
                  {!isNaN(parseFloat(watchAmountB)) && (
                    <h3 className="text-sm">{watchAmountB}</h3>
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
              <FormField
                control={control}
                name="currencyB"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Divisa</FormLabel>
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
                        <Input className="w-32" placeholder="$" {...field} />
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
              <FormField
                control={control}
                name="methodB"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método</FormLabel>
                    <CustomSelector
                      data={paymentMethods}
                      field={field}
                      fieldName="methodB"
                      placeholder="Elegir"
                    />
                  </FormItem>
                )}
              />
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
