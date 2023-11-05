"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Entities } from "@prisma/client";
import type { User } from "next-auth";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import z from "zod";
import EntityCard from "~/app/components/ui/EntityCard";
import { Icons } from "~/app/components/ui/icons";
import { currencies, paymentMethods } from "~/lib/variables";
import {
  useTransactionsStore,
  type SingleTransactionInStoreSchema,
} from "~/stores/TransactionsStore";
import { api } from "~/trpc/react";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import CustomSelector from "./CustomSelector";

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
  exchangeRate: z.string().optional(),
  lockDirection: z.boolean().default(false),
  direction: z.boolean().default(true),
});

interface OperationFormProps {
  user: User;
  initialEntities: Entities[];
}

const CambioForm = ({ user, initialEntities }: OperationFormProps) => {
  const { isLoading, data: entities } = api.entities.getAll.useQuery(
    undefined,
    {
      initialData: initialEntities,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  );

  const userEntityId = user
    ? entities?.find((obj) => obj.name === user.name)?.id
    : null;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      exchangeRate: "",
    },
  });

  const { handleSubmit, watch, control, setValue, reset } = form;

  const watchEntityA = useWatch({ name: "entityA", control: control });
  const watchEntityB = useWatch({ name: "entityB", control: control });
  const watchCurrencyA = watch("currencyA");
  const watchCurrencyB = watch("currencyB");
  const watchAmountA = watch("amountA");
  const watchAmountB = watch("amountB");
  const watchExchangeRate = watch("exchangeRate");
  const watchLockDirection = watch("lockDirection");

  const exchangeCalculation = () => {
    let exchangeRateValue = watchExchangeRate
      ? parseFloat(watchExchangeRate)
      : 0;
    if (isNaN(exchangeRateValue)) exchangeRateValue = 0;

    if (watchCurrencyA && watchCurrencyB) {
      const isStrongCurrencyA = currencies.find(
        (obj) => obj.value === watchCurrencyA,
      )?.strong;
      const isStrongCurrencyB = currencies.find(
        (obj) => obj.value === watchCurrencyB,
      )?.strong;

      if (!watchLockDirection) {
        if (watchCurrencyA === "usd" && watchCurrencyB === "usdt") {
          const amountA = parseFloat(watchAmountA);
          setValue(
            "amountB",
            (amountA / (exchangeRateValue / 100 + 1)).toFixed(4).toString(),
          );
        } else if (watchCurrencyA === "usdt" && watchCurrencyB === "usd") {
          const amountA = parseFloat(watchAmountA);
          setValue(
            "amountB",
            ((exchangeRateValue / 100 + 1) * amountA).toFixed(4).toString(),
          );
        } else if (isStrongCurrencyA && !isStrongCurrencyB) {
          const amountA = parseFloat(watchAmountA);
          setValue(
            "amountB",
            (amountA * exchangeRateValue).toFixed(2).toString(),
          );
        } else if (!isStrongCurrencyA && isStrongCurrencyB) {
          const amountA = parseFloat(watchAmountA);
          setValue(
            "amountB",
            (amountA / exchangeRateValue).toFixed(2).toString(),
          );
        }
      } else {
        if (watchCurrencyB === "usd" && watchCurrencyA === "usdt") {
          const amountB = parseFloat(watchAmountB);
          setValue(
            "amountA",
            (amountB * (exchangeRateValue / 100 + 1)).toFixed(4).toString(),
          );
        } else if (watchCurrencyB === "usdt" && watchCurrencyA === "usd") {
          const amountB = parseFloat(watchAmountB);
          setValue(
            "amountA",
            ((exchangeRateValue / 100 + 1) * amountB).toFixed(4).toString(),
          );
        } else if (isStrongCurrencyB && !isStrongCurrencyA) {
          const amountB = parseFloat(watchAmountB);
          setValue(
            "amountA",
            (amountB * exchangeRateValue).toFixed(2).toString(),
          );
        } else if (!isStrongCurrencyB && isStrongCurrencyA) {
          const amountB = parseFloat(watchAmountB);
          setValue(
            "amountA",
            (amountB / exchangeRateValue).toFixed(2).toString(),
          );
        }
      }
    }
  };

  useEffect(() => {
    exchangeCalculation();
  }, [watchAmountA, watchAmountB, watchExchangeRate]);

  const { addTransactionToStore } = useTransactionsStore();

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    const transactions: SingleTransactionInStoreSchema[] = [
      {
        txId: 0,
        type: "cambio",
        fromEntityId: parseInt(values.entityA),
        toEntityId: parseInt(values.entityB),
        operatorId: parseInt(values.entityOperator),
        currency: values.currencyB,
        amount: parseFloat(values.amountB),
      },
      {
        txId: 0,
        type: "cambio",
        fromEntityId: parseInt(values.entityB),
        toEntityId: parseInt(values.entityA),
        operatorId: parseInt(values.entityOperator),
        currency: values.currencyA,
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
      lockDirection: false,
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
                          entity={entities.find(
                            (obj) => obj.id.toString() === watchEntityA,
                          )}
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
              <div className="flex flex-row items-end">
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
                  {!watchLockDirection && (
                    <Icons.lock className="h-4 text-slate-900" />
                  )}
                  <FormField
                    control={form.control}
                    name="lockDirection"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchLockDirection && (
                    <Icons.lock className="h-4 text-slate-900" />
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center space-y-4">
                <div className="flex flex-row items-center space-x-2">
                  <Icons.arrowLeft className="h-8" />
                  <h3 className="text-sm">{watchAmountA}</h3>
                  <h3 className="text-sm">{watchCurrencyA?.toUpperCase()}</h3>
                </div>
                <div className="flex flex-row items-center space-x-2">
                  <h3 className="text-sm">{watchCurrencyB?.toUpperCase()}</h3>
                  <h3 className="text-sm">{watchAmountB}</h3>
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
                          entity={entities.find(
                            (obj) => obj.id.toString() === watchEntityB,
                          )}
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
          Añadir par de cambio
        </Button>
      </form>
    </Form>
  );
};

export default CambioForm;
