"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { type User } from "lucia";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import AmountInput from "~/app/operaciones/carga/AmountInput";
import { parseFormattedFloat } from "~/lib/functions";
import {
  cashAccountOnlyTypes,
  currencies,
  currentAccountOnlyTypes,
  gastoCategories,
  operationTypes,
} from "~/lib/variables";
import { useTransactionsStore } from "~/stores/TransactionsStore";
import { api } from "~/trpc/react";
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
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import CustomDropdownSelector from "./CustomDropdownSelector";
import CustomSelector from "./CustomSelector";

const FormSchema = z.object({
  transactions: z.array(
    z
      .object({
        type: z.string(),
        fromEntityId: z.string().min(1),
        toEntityId: z.string().min(1),
        operatorId: z.string().min(1),
        currency: z.string().min(1),
        amount: z.string().min(1),
        direction: z.boolean().optional().default(false),
        time: z.string().optional(),
        category: z.string().optional(),
        subCategory: z.string().optional(),
      })
      .superRefine((val, ctx) => {
        if (val.fromEntityId === val.toEntityId) {
          ctx.addIssue({
            code: "custom",
            message: "Las entidades no pueden ser iguales",
            path: ["fromEntityId", "toEntityId"],
          });
        }

        if (val.type === "gasto" && (!val.category || !val.subCategory)) {
          ctx.addIssue({
            code: "custom",
            message: "La categoría es requerida para gastos",
            path: ["subCategory"],
          });
        }
      }),
  ),
});
interface FlexibleTransactionsFormProps {
  user: User;
  entities: RouterOutputs["entities"]["getAll"];
  isLoading: boolean;
  mainTags: string[];
}

const FlexibleTransactionsForm = ({
  user,
  entities,
  isLoading,
  mainTags,
}: FlexibleTransactionsFormProps) => {
  const userEntityId = user
    ? entities?.find((obj) => obj.name === user.name)?.id
    : undefined;

  // Find the "Gastos" entity
  const gastosEntity = entities?.find((entity) => entity.name === "Gastos");

  const { data: blockOperatorsSetting } = api.globalSettings.get.useQuery({
    name: "blockOperators",
  });

  const blockOperatorsEnabled =
    blockOperatorsSetting?.name === "blockOperators" &&
    blockOperatorsSetting.data.enabled;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      transactions: [
        {
          operatorId: userEntityId ? userEntityId.toString() : undefined,
          currency: "ars",
          direction: true,
          fromEntityId: user.preferredEntity?.toString() ?? undefined,
        },
      ],
    },
  });

  const { handleSubmit, control, watch, reset, setValue } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "transactions",
  });

  const { addTransactionToStore, transactionsStore } = useTransactionsStore();

  const watchTransactions = watch("transactions");
  const watchType = watch("transactions.0.type");

  // Watch for type changes and automatically set toEntity to "Gastos" when type is "gasto"
  useEffect(() => {
    if (watchType === "gasto") {
      setValue(`transactions.0.toEntityId`, gastosEntity?.id.toString() ?? "");
    }
  }, [watchType, gastosEntity, setValue]);

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    if (
      values.transactions
        .flatMap((tx) => [parseFormattedFloat(tx.amount)])
        .some((amount) => amount === 0)
    ) {
      toast.error("Los montos no pueden ser 0");
      return;
    }
    const greatestId = transactionsStore.reduce((maxId, currentObject) => {
      return Math.max(maxId, currentObject.txId);
    }, 0);

    values.transactions.forEach((transaction, index) => {
      const fromTag = entities.find(
        (e) => e.id === parseInt(transaction.fromEntityId),
      )!.tag.name;
      const toTag = entities.find(
        (e) => e.id === parseInt(transaction.toEntityId),
      )!.tag.name;

      if (!mainTags.includes(fromTag) && !mainTags.includes(toTag)) {
        toast.error(`Transacción ${index + 1}`, {
          description: `Aunque sea una de las entidades tiene que pertencer al tag: ${mainTags.join(
            ", ",
          )}`,
        });
        return;
      }

      addTransactionToStore({
        txId: greatestId + index + 1,
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
        category: transaction.subCategory
          ? gastoCategories.find((category) =>
              category.subCategories.some(
                (subcategory) => subcategory.value === transaction.subCategory,
              ),
            )?.value
          : undefined,
        subCategory: transaction.subCategory,
      });
    });

    reset({ transactions: [{ amount: "", currency: "ars" }] });
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
          <div key={index}>
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
                          data={entities
                            .filter(
                              (entity) =>
                                !blockOperatorsEnabled ||
                                entity.tag.name !== "Operadores",
                            )
                            .map((entity) => ({
                              value: entity.id.toString(),
                              label: entity.name,
                            }))}
                          field={field}
                          fieldName={`transactions.${index}.fromEntityId`}
                        />
                        {watchTransactions[index]?.fromEntityId && (
                          <EntityCard
                            disableLinks={true}
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
                {watchTransactions[index]?.type === "gasto" && (
                  <div className="flex flex-col items-center space-y-2">
                    <Label>Categoria</Label>
                    <FormField
                      control={control}
                      name={`transactions.${index}.subCategory`}
                      render={({ field }) => (
                        <FormItem>
                          <CustomDropdownSelector
                            data={gastoCategories.map((category) => ({
                              value: category.value,
                              label: category.label,
                              subData: category.subCategories,
                            }))}
                            onSelect={(value, subValue) => {
                              if (value && subValue) {
                                setValue(
                                  `transactions.${index}.category`,
                                  value,
                                );
                                field.onChange(subValue);
                              } else {
                                setValue(
                                  `transactions.${index}.category`,
                                  undefined,
                                );
                                field.onChange(null);
                              }
                            }}
                            selectedValue={watch(
                              `transactions.${index}.category`,
                            )}
                            selectedSubValue={field.value}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                {entities && (
                  <FormField
                    control={control}
                    name={`transactions.${index}.operatorId`}
                    defaultValue={userEntityId?.toString()}
                    render={({ field }) => (
                      <FormItem className="mx-auto mt-2 flex flex-col">
                        <FormLabel>Operador</FormLabel>
                        <CustomSelector
                          data={entities
                            .filter(
                              (entity) => entity.tag.name === "Operadores",
                            )
                            .map((entity) => ({
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
                          data={entities
                            .filter(
                              (entity) =>
                                !blockOperatorsEnabled ||
                                entity.tag.name !== "Operadores",
                            )
                            .map((entity) => ({
                              value: entity.id.toString(),
                              label: entity.name,
                            }))}
                          field={field}
                          fieldName={`transactions.${index}.toEntityId`}
                          disabled={watchTransactions[index]?.type === "gasto"}
                        />
                        {watchTransactions[index]?.toEntityId && (
                          <EntityCard
                            disableLinks={true}
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
            <div
              className="mt-4 flex flex-row justify-center space-x-8"
              key={index}
            >
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
                    fromEntityId: watchTransactions[index]?.fromEntityId ?? "",
                    toEntityId: watchTransactions[index]?.toEntityId ?? "",
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
            <Separator key={index} className="mb-8" />
          </div>
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
