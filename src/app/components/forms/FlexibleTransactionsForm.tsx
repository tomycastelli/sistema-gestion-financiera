"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Separator } from "@radix-ui/react-dropdown-menu";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import {
  cashAccountOnlyTypes,
  currencies,
  currentAccountOnlyTypes,
  operationTypes,
} from "~/lib/variables";
import { useTransactionsStore } from "~/stores/TransactionsStore";
import { type RouterOutputs } from "~/trpc/shared";
import EntityCard from "../ui/EntityCard";
import { Icons } from "../ui/Icons";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Switch } from "../ui/switch";
import CustomSelector from "./CustomSelector";
import { type User } from "lucia";
import { useNumberFormat } from "@react-input/number-format";
import { parseFormattedFloat } from "~/lib/functions";
import { type MutableRefObject, useRef } from "react";
import AmountInput from "~/app/operaciones/carga/AmountInput";
import { Label } from "../ui/label";

const FormSchema = z.object({
  transactions: z.array(
    z.object({
      type: z.string(),
      fromEntityId: z.string().min(1),
      toEntityId: z.string().min(1),
      operatorId: z.string().min(1),
      currency: z.string().min(1),
      amount: z.string().min(1),
      direction: z.boolean().optional().default(false),
      time: z.string().optional(),
    }).refine(data => data.fromEntityId !== data.toEntityId, {
      message: "La entidad de origen y la entidad de destino no pueden ser la misma",
      path: ['toEntityId']
    }),
  ),
});

interface FlexibleTransactionsFormProps {
  user: User;
  entities: RouterOutputs["entities"]["getAll"];
  isLoading: boolean;
}

const FlexibleTransactionsForm = ({
  user,
  entities,
  isLoading,
}: FlexibleTransactionsFormProps) => {
  const userEntityId = user
    ? entities?.find((obj) => obj.name === user.name)?.id
    : undefined;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      transactions: [
        {
          operatorId: userEntityId ? userEntityId.toString() : undefined,
          currency: "ars",
          direction: true,
        },
      ],
    },
  });

  const { handleSubmit, control, watch, reset } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "transactions",
  });

  const { addTransactionToStore } = useTransactionsStore();

  const watchTransactions = watch("transactions");

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    values.transactions.forEach((transaction) =>
      addTransactionToStore({
        type: transaction.type,
        fromEntityId: transaction.direction
          ? parseInt(transaction.fromEntityId)
          : parseInt(transaction.toEntityId),
        toEntityId: transaction.direction
          ? parseInt(transaction.toEntityId)
          : parseInt(transaction.fromEntityId),
        operatorId: parseInt(transaction.operatorId),
        currency: transaction.currency,
        amount: parseFormattedFloat(transaction.amount),
      }),
    );

    reset();
  };

  const [parent] = useAutoAnimate();

  const myRefs = useRef<MutableRefObject<HTMLInputElement | null>[]>([]);

  myRefs.current[0] = useNumberFormat({ locales: "es-AR" })
  myRefs.current[1] = useNumberFormat({ locales: "es-AR" })
  myRefs.current[2] = useNumberFormat({ locales: "es-AR" })
  myRefs.current[3] = useNumberFormat({ locales: "es-AR" })
  myRefs.current[4] = useNumberFormat({ locales: "es-AR" })
  myRefs.current[5] = useNumberFormat({ locales: "es-AR" })
  myRefs.current[6] = useNumberFormat({ locales: "es-AR" })

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col justify-center"
        ref={parent}
      >
        {fields.map((field, index) => (
          <>
            <div
              key={field.id}
              className="grid grid-cols-1 justify-center gap-4 lg:grid-cols-3"
            >
              {entities && (
                <div className="lg:justify-self-start">
                  <FormField
                    control={control}
                    name={`transactions.${index}.fromEntityId`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Entidad</FormLabel>
                        <CustomSelector
                          isLoading={isLoading}
                          placeholder="Entidad"
                          data={entities.map((entity) => ({
                            value: entity.id.toString(),
                            label: entity.name,
                          }))}
                          field={field}
                          fieldName={`transactions.${index}.fromEntityId`}
                        />
                        {watchTransactions[index]?.fromEntityId && (
                          <EntityCard
                            className="w-[150px]"
                            entity={
                              entities.find(
                                (obj) =>
                                  obj.id.toString() ===
                                  watchTransactions[index]?.fromEntityId,
                              )!
                            }
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="flex flex-col items-center space-y-2">
                  <FormField
                    control={control}
                    name={`transactions.${index}.direction`}
                    render={({ field }) => (
                      <FormItem className="mx-auto flex flex-row items-center rounded-lg">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-readonly
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchTransactions[index]?.direction ? (
                    <Icons.arrowRight className="h-12" />
                  ) : (
                    <Icons.arrowLeft className="h-12" />
                  )}
                </div>
                <div className="flex flex-row items-end space-x-2">
                  <FormField
                    control={control}
                    name={`transactions.${index}.currency`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Divisa</FormLabel>
                        <CustomSelector
                          buttonClassName="w-22"
                          data={currencies}
                          field={field}
                          fieldName={`transactions.${index}.currency`}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <AmountInput name={`transactions.${index}.amount`} />
                </div>
                <div className="flex flex-row space-x-2">
                  <div className="flex flex-col items-center space-y-1">
                    <Label>Tipo</Label>
                    <FormField
                      control={control}
                      name={`transactions.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <CustomSelector
                            buttonClassName="w-36"
                            data={operationTypes}
                            field={field}
                            fieldName={`transactions.${index}.type`}
                            placeholder="Elegir"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {watchTransactions[index]?.type && (
                      <p className="text-sm text-muted-foreground">
                        {currentAccountOnlyTypes.has(
                          // @ts-ignore
                          watchTransactions[index].type,
                        )
                          ? "La transacción no podrá ser confirmada"
                          : cashAccountOnlyTypes.has(
                            // @ts-ignore
                            watchTransactions[index].type,
                          )
                            ? "La transacción solo afectará caja"
                            : watchTransactions[index]?.type ===
                              "pago por cta cte"
                              ? "La transacción será confirmada automaticamente"
                              : ""}
                      </p>
                    )}
                  </div>
                </div>
                {entities && (
                  <FormField
                    control={control}
                    name={`transactions.${index}.operatorId`}
                    defaultValue={userEntityId?.toString()}
                    render={({ field }) => (
                      <FormItem className="mx-auto mt-2 flex flex-col">
                        <FormLabel>Operador</FormLabel>
                        <CustomSelector
                          data={entities.map((entity) => ({
                            value: entity.id.toString(),
                            label: entity.name,
                          }))}
                          field={field}
                          fieldName={`transactions.${index}.operatorId`}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              {entities && (
                <div className="lg:justify-self-end">
                  <FormField
                    control={control}
                    name={`transactions.${index}.toEntityId`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Entidad</FormLabel>
                        <CustomSelector
                          isLoading={isLoading}
                          placeholder="Entidad"
                          data={entities.map((entity) => ({
                            value: entity.id.toString(),
                            label: entity.name,
                          }))}
                          field={field}
                          fieldName={`transactions.${index}.toEntityId`}
                        />
                        {watchTransactions[index]?.toEntityId && (
                          <EntityCard
                            className="w-[150px]"
                            entity={
                              entities.find(
                                (obj) =>
                                  obj.id.toString() ===
                                  watchTransactions[index]?.toEntityId,
                              )!
                            }
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-row justify-center space-x-8">
              {index > 0 && (
                <Button
                  type="button"
                  onClick={() => remove(index)}
                  variant="outline"
                >
                  <Icons.removePackage className="h-6 text-red" />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({
                    fromEntityId: "",
                    toEntityId: "",
                    amount: "",
                    currency: "ars",
                    direction: !!watchTransactions[index]?.direction,
                    operatorId: userEntityId ? userEntityId.toString() : "",
                    type: "",
                  })
                }
              >
                <Icons.addPackage className="h-6 text-green" />
              </Button>
            </div>
            <Separator className="mb-8" />
          </>
        ))}
        <Button type="submit" className="mx-auto mt-6">
          <Icons.addPackage className="mr-2 h-5" />
          Añadir transacciones
        </Button>
      </form>
    </Form>
  );
};

export default FlexibleTransactionsForm;
