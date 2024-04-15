"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { isNumeric } from "~/lib/functions";
import { currencies, paymentMethods } from "~/lib/variables";
import {
  useTransactionsStore,
  type SingleTransactionInStoreSchema,
} from "~/stores/TransactionsStore";
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
import { Input } from "../ui/input";
import CustomSelector from "./CustomSelector";
import { useNumberFormat } from "@react-input/number-format";

const FormSchema = z.object({
  emittingEntity: z.string(),
  receivingEntity: z.string(),
  middleEntity: z.string(),
  operatorEntity: z.string(),
  currency: z.string(),
  emittingMethod: z.string().optional(),
  receivingMethod: z.string().optional(),
  amount: z.string().refine((value) => isNumeric(value), {
    message: "Tiene que ser un valor númerico",
  }),
  emittingFee: z
    .string()
    .optional()
    .refine((value) => value ? isNumeric(value) : true, {
      message: "Tiene que ser un valor númerico",
    }),
  receivingFee: z
    .string()
    .optional()
    .refine((value) => value ? isNumeric(value) : true, {
      message: "Tiene que ser un valor númerico",
    }),
}).refine(data => data.emittingEntity !== data.receivingEntity, {
  message: "La entidad emisora y receptora no puede ser la misma",
  path: ['receivingEntity']
});

interface CableFormProps {
  userEntityId: string;
  entities: RouterOutputs["entities"]["getAll"];
}

const CableForm: FC<CableFormProps> = ({ userEntityId, entities }) => {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      operatorEntity: userEntityId,
    },
  });

  const { handleSubmit, control, reset, watch } = form;

  const watchEmittingEntity = watch("emittingEntity");
  const watchReceivingEntity = watch("receivingEntity");
  const watchMiddleEntity = watch("middleEntity");
  const watchEmittingFee = watch("emittingFee");
  const watchReceivingFee = watch("receivingFee");
  const watchAmount = watch("amount");

  const { addTransactionToStore } = useTransactionsStore();

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    const transactions: SingleTransactionInStoreSchema[] = [
      {
        txId: 0,
        type: "cable",
        fromEntityId: parseInt(values.emittingEntity),
        toEntityId: parseInt(values.middleEntity),
        currency: values.currency,
        amount: parseFloat(values.amount),
        operatorId: parseInt(values.operatorEntity),
        method: values.emittingMethod,
      },
      {
        txId: 0,
        type: "cable",
        fromEntityId: parseInt(values.middleEntity),
        toEntityId: parseInt(values.receivingEntity),
        currency: values.currency,
        amount: parseFloat(values.amount),
        operatorId: parseInt(values.operatorEntity),
        method: values.receivingMethod,
      },
    ];
    if (
      values.emittingFee &&
      isNumeric(values.emittingFee) &&
      parseFloat(values.emittingFee) !== 0
    ) {
      transactions.push({
        txId: 0,
        type: "fee",
        fromEntityId:
          parseFloat(values.emittingFee) > 0
            ? parseInt(values.emittingEntity)
            : parseInt(values.middleEntity),
        toEntityId:
          parseFloat(values.emittingFee) < 0
            ? parseInt(values.emittingEntity)
            : parseInt(values.middleEntity),
        currency: values.currency,
        amount: Math.abs(
          (parseFloat(values.amount) * parseFloat(values.emittingFee)) / 100,
        ),
        operatorId: parseInt(values.operatorEntity),
      });
    }
    if (
      values.receivingFee &&
      isNumeric(values.receivingFee) &&
      parseFloat(values.receivingFee) !== 0
    ) {
      transactions.push({
        txId: 0,
        type: "fee",
        fromEntityId:
          parseFloat(values.receivingFee) < 0
            ? parseInt(values.receivingEntity)
            : parseInt(values.middleEntity),
        toEntityId:
          parseFloat(values.receivingFee) > 0
            ? parseInt(values.receivingEntity)
            : parseInt(values.middleEntity),
        currency: values.currency,
        amount: Math.abs(
          (parseFloat(values.amount) * parseFloat(values.receivingFee)) / 100,
        ),
        operatorId: parseInt(values.operatorEntity),
      });
    }

    transactions.forEach((transaction) => {
      addTransactionToStore(transaction);
    });

    reset();
  };

  const inputRef = useNumberFormat({ locales: "es-AR" })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-3">
          <div className="flex flex-col space-y-3 justify-self-center">
            <FormField
              control={control}
              name="emittingEntity"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Entidad Emisora</FormLabel>
                  <>
                    <CustomSelector
                      data={entities.map((entity) => ({
                        value: entity.id.toString(),
                        label: entity.name,
                      }))}
                      field={field}
                      fieldName="emittingEntity"
                      placeholder="Elegir"
                    />
                    {watchEmittingEntity && (
                      <EntityCard
                        entity={
                          entities.find(
                            (obj) => obj.id.toString() === watchEmittingEntity,
                          )!
                        }
                      />
                    )}
                  </>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="emittingMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método</FormLabel>
                  <CustomSelector
                    data={paymentMethods}
                    field={field}
                    fieldName="emittingMethod"
                    placeholder="Elegir"
                  />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="emittingFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee</FormLabel>
                  <FormControl>
                    <Input className="w-32" placeholder="%" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            {watchEmittingFee &&
              (isNumeric(watchEmittingFee) &&
                parseFloat(watchEmittingFee) !== 0 ? (
                <p>
                  {Math.abs(
                    (parseFloat(watchEmittingFee) * parseFloat(watchAmount)) /
                    100,
                  ).toFixed(2)}{" "}
                  {parseFloat(watchEmittingFee) > 0
                    ? "a favor"
                    : parseFloat(watchEmittingFee) < 0
                      ? "en contra"
                      : ""}
                </p>
              ) : (
                <p className="w-24 text-red">
                  El valor tiene que ser numérico y distinto de 0
                </p>
              ))}
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex flex-row items-end justify-center space-x-2">
              <FormField
                control={control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Divisa</FormLabel>
                    <CustomSelector
                      buttonClassName="w-18"
                      data={currencies}
                      field={field}
                      fieldName="currency"
                      placeholder="Elegir"
                    />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <Input ref={inputRef} className="w-32" placeholder="$" name={field.name} value={field.value} onChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={control}
              name="middleEntity"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Entidad Intermediadora</FormLabel>
                  <>
                    <CustomSelector
                      data={entities.map((entity) => ({
                        value: entity.id.toString(),
                        label: entity.name,
                      }))}
                      field={field}
                      fieldName="middleEntity"
                      placeholder="Elegir"
                    />
                    {watchMiddleEntity && (
                      <EntityCard
                        entity={
                          entities.find(
                            (obj) => obj.id.toString() === watchMiddleEntity,
                          )!
                        }
                      />
                    )}
                  </>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="operatorEntity"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Operador</FormLabel>
                  <CustomSelector
                    data={entities.map((entity) => ({
                      value: entity.id.toString(),
                      label: entity.name,
                    }))}
                    field={field}
                    fieldName="operatorEntity"
                    placeholder="Elegir"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex flex-col space-y-3 justify-self-center">
            <FormField
              control={control}
              name="receivingEntity"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Entidad Receptora</FormLabel>
                  <>
                    <CustomSelector
                      data={entities.map((entity) => ({
                        value: entity.id.toString(),
                        label: entity.name,
                      }))}
                      field={field}
                      fieldName="receivingEntity"
                      placeholder="Elegir"
                    />
                    {watchReceivingEntity && (
                      <EntityCard
                        entity={
                          entities.find(
                            (obj) => obj.id.toString() === watchReceivingEntity,
                          )!
                        }
                      />
                    )}
                  </>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="receivingMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método</FormLabel>
                  <CustomSelector
                    data={paymentMethods}
                    field={field}
                    fieldName="receivingMethod"
                    placeholder="Elegir"
                  />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="receivingFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee</FormLabel>
                  <FormControl>
                    <Input className="w-32" placeholder="%" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            {watchReceivingFee &&
              (isNumeric(watchReceivingFee) &&
                parseFloat(watchReceivingFee) !== 0 ? (
                <p>
                  {Math.abs(
                    (parseFloat(watchReceivingFee) * parseFloat(watchAmount)) /
                    100,
                  ).toFixed(2)}{" "}
                  {parseFloat(watchReceivingFee) > 0
                    ? "en contra"
                    : parseFloat(watchReceivingFee) < 0
                      ? "a favor"
                      : ""}
                </p>
              ) : (
                <p className="w-24 text-red">
                  El valor tiene que ser numérico y distinto de 0
                </p>
              ))}
          </div>
        </div>
        <div className="mt-4 flex w-full justify-center">
          <Button type="submit">
            <Icons.addPackage className="mr-2 h-5" />
            Añadir cable
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CableForm;
