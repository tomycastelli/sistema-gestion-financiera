"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useNumberFormat } from "@react-input/number-format";
import { User } from "lucia";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { numberFormatter, parseFormattedFloat } from "~/lib/functions";
import { currencies } from "~/lib/variables";
import {
  useTransactionsStore,
  type SingleTransactionInStoreSchema,
} from "~/stores/TransactionsStore";
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
import { Input } from "../ui/input";
import CustomSelector from "./CustomSelector";

const FormSchema = z
  .object({
    emittingEntity: z.string(),
    receivingEntity: z.string(),
    middleEntity: z.string(),
    bridgeEntity: z.string().optional(),
    operatorEntity: z.string(),
    emittingCurrency: z.string(),
    receivingCurrency: z.string(),
    amount: z.string(),
    emittingFee: z.string().optional(),
    receivingFee: z.string().optional(),
  })
  .refine((data) => data.emittingEntity !== data.receivingEntity, {
    message: "La entidad emisora y receptora no puede ser la misma",
    path: ["receivingEntity"],
  });

interface CableFormProps {
  entities: RouterOutputs["entities"]["getAll"];
  mainTags: string[];
  user: User;
}

const CableForm: FC<CableFormProps> = ({ entities, mainTags, user }) => {
  const { data: blockOperatorsSetting } = api.globalSettings.get.useQuery({
    name: "blockOperators",
  });

  const blockOperatorsEnabled =
    blockOperatorsSetting?.name === "blockOperators" &&
    blockOperatorsSetting.data.enabled;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      operatorEntity: entities
        .find((entity) => entity.name === user.name)!
        .id.toString()
        ? entities.find((entity) => entity.name === user.name)!.id.toString()
        : "",
      middleEntity: user.preferredEntity?.toString() ?? undefined,
      amount: "",
    },
  });

  const { handleSubmit, control, reset, watch, setError } = form;

  const watchEmittingEntity = watch("emittingEntity");
  const watchReceivingEntity = watch("receivingEntity");
  const watchMiddleEntity = watch("middleEntity");
  const watchBridgeEntity = watch("bridgeEntity");
  const watchEmittingFee = watch("emittingFee");
  const watchReceivingFee = watch("receivingFee");
  const watchAmount = parseFormattedFloat(watch("amount"));
  const watchEmittingCurrency = watch("emittingCurrency");
  const watchReceivingCurrency = watch("receivingCurrency");

  const parsedWatchEmittingFee = watchEmittingFee
    ? parseFormattedFloat(watchEmittingFee)
    : undefined;
  const parsedWatchReceivingFee = watchReceivingFee
    ? parseFormattedFloat(watchReceivingFee)
    : undefined;

  const { addTransactionToStore, transactionsStore } = useTransactionsStore();

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    if (parseFormattedFloat(values.amount) === 0) {
      toast.error("El monto no puede ser 0");
      setError("amount", {
        type: "pattern",
        message: "El monto no puede ser 0",
      });
      return;
    }
    const parsedAmount = parseFormattedFloat(values.amount);
    const parsedReceivingFee = values.receivingFee
      ? parseFormattedFloat(values.receivingFee)
      : 0;
    const parsedEmittingFee = values.emittingFee
      ? parseFormattedFloat(values.emittingFee)
      : 0;

    if (
      values.emittingCurrency !== values.receivingCurrency &&
      !values.bridgeEntity
    ) {
      setError(
        "bridgeEntity",
        {
          type: "required",
          message:
            "Si las divisas son distintas, se requiere una entidad puente.",
        },
        {
          shouldFocus: true,
        },
      );
      return;
    }

    const parsedEmittingEntity = parseInt(values.emittingEntity);
    const parsedBridgeEntity = parseInt(values.bridgeEntity ?? "0");
    const parsedMiddleEntity = parseInt(values.middleEntity);
    const parsedOperatorEntity = parseInt(values.operatorEntity);
    const parsedReceivingEntity = parseInt(values.receivingEntity);

    const greatestId = transactionsStore.reduce((maxId, currentObject) => {
      return Math.max(maxId, currentObject.txId);
    }, 0);

    const transactions: SingleTransactionInStoreSchema[] = [
      {
        txId: greatestId + 1,
        type: "cable",
        fromEntityId: parsedEmittingEntity,
        toEntityId: parsedMiddleEntity,
        currency: values.emittingCurrency,
        amount: parsedAmount,
        operatorId: parsedOperatorEntity,
        relatedTxId: greatestId + 2,
      },
      {
        txId: greatestId + 2,
        type: "cable",
        fromEntityId: parsedMiddleEntity,
        toEntityId: parsedReceivingEntity,
        currency: values.receivingCurrency,
        amount: parsedAmount,
        operatorId: parsedOperatorEntity,
        relatedTxId: greatestId + 1,
      },
    ];
    if (values.emittingFee && parsedEmittingFee !== 0) {
      transactions.push({
        txId: greatestId + 3,
        type: "fee",
        fromEntityId:
          parsedEmittingFee < 0 ? parsedEmittingEntity : parsedMiddleEntity,
        toEntityId:
          parsedEmittingFee > 0 ? parsedEmittingEntity : parsedMiddleEntity,
        currency: values.emittingCurrency,
        amount: Math.abs((parsedAmount * parsedEmittingFee) / 100),
        operatorId: parseInt(values.operatorEntity),
        relatedTxId: greatestId + 1,
      });
    }
    if (values.receivingFee && parsedReceivingFee !== 0) {
      transactions.push({
        txId: greatestId + 4,
        type: "fee",
        fromEntityId:
          parsedReceivingFee > 0 ? parsedReceivingEntity : parsedMiddleEntity,
        toEntityId:
          parsedReceivingFee < 0 ? parsedReceivingEntity : parsedMiddleEntity,
        currency: values.receivingCurrency,
        amount: Math.abs((parsedAmount * parsedReceivingFee) / 100),
        operatorId: parsedOperatorEntity,
        relatedTxId: greatestId + 2,
      });
    }
    if (
      values.emittingCurrency !== values.receivingCurrency &&
      parsedBridgeEntity !== 0
    ) {
      transactions.push(
        {
          txId: greatestId + 5,
          type: "cable",
          fromEntityId: parsedMiddleEntity,
          toEntityId: parsedBridgeEntity,
          currency:
            values.emittingCurrency !== "usd"
              ? values.emittingCurrency
              : values.receivingCurrency,
          amount: parsedAmount,
          operatorId: parsedOperatorEntity,
          relatedTxId: greatestId + 1,
        },
        {
          txId: greatestId + 6,
          type: "cable",
          fromEntityId: parsedBridgeEntity,
          toEntityId: parsedMiddleEntity,
          currency:
            values.emittingCurrency !== "usd"
              ? values.receivingCurrency
              : values.emittingCurrency,
          amount: parsedAmount,
          operatorId: parsedOperatorEntity,
          relatedTxId: greatestId + 2,
        },
      );
    }

    const middleEntityTag = entities.find(
      (e) => e.id === parseInt(values.middleEntity),
    )!.tag.name;

    if (!mainTags.includes(middleEntityTag)) {
      const message = `La entidad mediadora tiene que pertencer al tag: ${mainTags.join(
        ", ",
      )}`;
      toast.error(message);
      setError(
        "middleEntity",
        {
          type: "pattern",
          message,
        },
        { shouldFocus: true },
      );
      return;
    }

    transactions.forEach((transaction) => {
      addTransactionToStore(transaction);
    });

    reset();
  };

  const inputRef1 = useNumberFormat({
    locales: "es-AR",
    maximumFractionDigits: 24,
  });
  const inputRef2 = useNumberFormat({
    locales: "es-AR",
  });
  const inputRef3 = useNumberFormat({
    locales: "es-AR",
    maximumFractionDigits: 24,
  });

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
                      fieldName="emittingEntity"
                      placeholder="Elegir"
                    />
                    {watchEmittingEntity && (
                      <EntityCard
                        disableLinks={true}
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
              name="emittingCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisa</FormLabel>
                  <CustomSelector
                    buttonClassName="w-18"
                    data={currencies}
                    field={field}
                    fieldName="emittingCurrency"
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
                    <Input
                      ref={inputRef1}
                      className="w-32"
                      placeholder="$"
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {parsedWatchEmittingFee &&
              (watchEmittingFee && parsedWatchEmittingFee !== 0 ? (
                <p>
                  {numberFormatter(
                    Math.abs((parsedWatchEmittingFee * watchAmount) / 100),
                  )}{" "}
                  {parsedWatchEmittingFee > 0
                    ? "a favor"
                    : parsedWatchEmittingFee < 0
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <Input
                        ref={inputRef2}
                        className="w-32"
                        name={field.name}
                        placeholder="$"
                        value={field.value}
                        onChange={field.onChange}
                      />
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
                      data={entities
                        .filter(
                          (e) =>
                            mainTags.includes(e.tag.name) &&
                            (!blockOperatorsEnabled ||
                              e.tag.name !== "Operadores"),
                        )
                        .map((entity) => ({
                          value: entity.id.toString(),
                          label: entity.name,
                        }))}
                      field={field}
                      fieldName="middleEntity"
                      placeholder="Elegir"
                    />
                    {watchMiddleEntity && (
                      <EntityCard
                        disableLinks={true}
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
            {watchReceivingCurrency !== watchEmittingCurrency && (
              <FormField
                control={control}
                name="bridgeEntity"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Entidad Puente</FormLabel>
                    <>
                      <CustomSelector
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
                        fieldName="bridgeEntity"
                        placeholder="Elegir"
                      />
                      {watchBridgeEntity && (
                        <EntityCard
                          disableLinks={true}
                          entity={
                            entities.find(
                              (obj) => obj.id.toString() === watchBridgeEntity,
                            )!
                          }
                        />
                      )}
                    </>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={control}
              name="operatorEntity"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Operador</FormLabel>
                  <CustomSelector
                    data={entities
                      .filter((entity) => entity.tag.name === "Operadores")
                      .map((entity) => ({
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
          <div className="flex flex-col gap-y-3 justify-self-center">
            <FormField
              control={control}
              name="receivingEntity"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Entidad Receptora</FormLabel>
                  <>
                    <CustomSelector
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
                      fieldName="receivingEntity"
                      placeholder="Elegir"
                    />
                    {watchReceivingEntity && (
                      <EntityCard
                        disableLinks={true}
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
              name="receivingCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisa</FormLabel>
                  <CustomSelector
                    buttonClassName="w-18"
                    data={currencies}
                    field={field}
                    fieldName="receivingCurrency"
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
                    <Input
                      ref={inputRef3}
                      className="w-32"
                      placeholder="$"
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {parsedWatchReceivingFee &&
              (watchReceivingFee && parsedWatchReceivingFee !== 0 ? (
                <p>
                  {numberFormatter(
                    Math.abs((parsedWatchReceivingFee * watchAmount) / 100),
                  )}{" "}
                  {parsedWatchReceivingFee > 0
                    ? "en contra"
                    : parsedWatchReceivingFee < 0
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
