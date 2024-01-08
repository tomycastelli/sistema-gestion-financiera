"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Separator } from "@radix-ui/react-dropdown-menu";
import { CalendarIcon } from "lucide-react";
import moment from "moment";
import type { User } from "next-auth";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { cn } from "~/lib/utils";
import {
  cashAccountOnlyTypes,
  currencies,
  currentAccountOnlyTypes,
  operationTypes,
  paymentMethods,
} from "~/lib/variables";
import { useTransactionsStore } from "~/stores/TransactionsStore";
import { type RouterOutputs } from "~/trpc/shared";
import EntityCard from "../ui/EntityCard";
import { Icons } from "../ui/Icons";
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
import { Switch } from "../ui/switch";
import CustomSelector from "./CustomSelector";

const FormSchema = z.object({
  transactions: z.array(
    z.object({
      type: z.string(),
      fromEntityId: z.string().min(1),
      toEntityId: z.string().min(1),
      operatorId: z.string().min(1),
      currency: z.string().min(1),
      amount: z.string().min(1),
      method: z.string().optional(),
      direction: z.boolean().optional().default(false),
      date: z.date().optional(),
      time: z.string().optional(),
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
        amount: parseFloat(transaction.amount),
        method: transaction.method,
        date: transaction.date,
        time: transaction.time,
      }),
    );

    reset();
  };

  const [parent] = useAutoAnimate();

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
                <div className="justify-self-start">
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
                    name={`transactions.${index}.date`}
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
                                date > new Date() ||
                                date < new Date(new Date().setDate(0))
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
                    control={control}
                    name={`transactions.${index}.time`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tiempo</FormLabel>
                        <FormControl>
                          <Input className="w-[72px]" type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={control}
                    name={`transactions.${index}.amount`}
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
                <div className="flex flex-row space-x-2">
                  <FormField
                    control={control}
                    name={`transactions.${index}.method`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método</FormLabel>
                        <CustomSelector
                          buttonClassName="w-32"
                          data={paymentMethods}
                          field={field}
                          fieldName={`transactions.${index}.method`}
                          placeholder="Elegir"
                        />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-col items-center space-y-1">
                    <FormField
                      control={control}
                      name={`transactions.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo</FormLabel>
                          <CustomSelector
                            buttonClassName="w-36"
                            data={operationTypes}
                            field={field}
                            fieldName={`transactions.${index}.type`}
                            placeholder="Elegir"
                          />
                        </FormItem>
                      )}
                    />
                    {watchTransactions[index]?.type && (
                      <p className="text-sm text-muted-foreground">
                        {currentAccountOnlyTypes.includes(
                          // @ts-ignore
                          watchTransactions[index].type,
                        )
                          ? "La transacción no podrá ser confirmada"
                          : cashAccountOnlyTypes.includes(
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
                <div className="justify-self-end">
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
                    method: "",
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
