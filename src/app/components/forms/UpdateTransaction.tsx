"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useNumberFormat } from "@react-input/number-format";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { numberFormatter, parseFormattedFloat } from "~/lib/functions";
import { currencies, gastoCategories } from "~/lib/variables";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import EntityCard from "../ui/EntityCard";
import { Icons } from "../ui/Icons";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import CustomDropdownSelector from "./CustomDropdownSelector";
import CustomSelector from "./CustomSelector";

interface UpdateTransactionProps {
  transaction: RouterOutputs["operations"]["getOperations"]["operations"][number]["transactions"][number];
  entities: RouterOutputs["entities"]["getAll"];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
}

const FormSchema = z.object({
  fromEntityId: z.string(),
  toEntityId: z.string(),
  operatorEntityId: z.string(),
  currency: z.string(),
  amount: z.string(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
});

const UpdateTransaction = ({
  transaction: tx,
  entities,
  operationsQueryInput,
}: UpdateTransactionProps) => {
  const utils = api.useContext();
  const [isOpen, setIsOpen] = useState(false);

  const { mutate, isLoading } =
    api.editingOperations.updateTransactionValues.useMutation({
      async onMutate(newOperation) {
        reset({
          fromEntityId: newOperation.newTransactionData.fromEntityId.toString(),
          toEntityId: newOperation.newTransactionData.toEntityId.toString(),
          operatorEntityId:
            newOperation.newTransactionData.operatorEntityId.toString(),
          currency: newOperation.newTransactionData.currency,
          amount: newOperation.newTransactionData.amount.toString(),
          category: newOperation.newTransactionData.category,
          subCategory: newOperation.newTransactionData.subCategory,
        });

        await utils.operations.getOperations.cancel();

        const prevData =
          utils.operations.getOperations.getData(operationsQueryInput);

        utils.operations.getOperations.setData(operationsQueryInput, (old) => ({
          ...old!,
          operations: old!.operations.map((operation) => {
            const updatedTransactions = operation.transactions.map(
              (transaction) => {
                if (newOperation.txId === transaction.id) {
                  return {
                    ...transaction,
                    fromEntityId: newOperation.newTransactionData.fromEntityId,
                    toEntityId: newOperation.newTransactionData.toEntityId,
                    operatorEntityId:
                      newOperation.newTransactionData.operatorEntityId,
                    currency: newOperation.newTransactionData.currency,
                    amount: newOperation.newTransactionData.amount,
                    category: newOperation.newTransactionData.category ?? null,
                    subCategory:
                      newOperation.newTransactionData.subCategory ?? null,
                  };
                }
                return transaction;
              },
            );
            return {
              ...operation,
              transactions: updatedTransactions,
            };
          }),
        }));

        return { prevData };
      },
      onError(err) {
        const prevData =
          utils.operations.getOperations.getData(operationsQueryInput);
        // Doing some ui actions
        toast.error("No se pudieron actualizar las transacciones", {
          description: err.message,
        });
        return { prevData };
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate();
        void utils.movements.getCurrentAccounts.invalidate();
        void utils.movements.getBalancesByEntities.invalidate();
      },
      onSuccess(data) {
        setIsOpen(false);
        toast.success(`Transacción ${data.id} editada`);
      },
    });

  const defaultTxValues = useMemo(
    () => ({
      fromEntityId: tx.fromEntityId.toString(),
      toEntityId: tx.toEntityId.toString(),
      operatorEntityId: tx.operatorEntityId.toString(),
      currency: tx.currency,
      amount: numberFormatter(tx.amount),
      category: tx.category ?? undefined,
      subCategory: tx.subCategory ?? undefined,
    }),
    [
      tx.amount,
      tx.currency,
      tx.fromEntityId,
      tx.operatorEntityId,
      tx.toEntityId,
      tx.category,
      tx.subCategory,
    ],
  );

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: defaultTxValues,
  });

  const { handleSubmit, control, watch, reset, setValue } = form;

  const watchFromEntity = watch("fromEntityId");
  const watchToEntity = watch("toEntityId");
  const watchOperatorEntity = watch("operatorEntityId");

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    mutate({
      txId: tx.id,
      txType: tx.type,
      newTransactionData: {
        fromEntityId: parseInt(values.fromEntityId),
        toEntityId: parseInt(values.toEntityId),
        operatorEntityId: parseInt(values.operatorEntityId),
        currency: values.currency,
        amount: parseFormattedFloat(values.amount),
        category: values.category,
        subCategory: values.subCategory,
      },
      oldTransactionData: {
        fromEntityId: tx.fromEntityId,
        toEntityId: tx.toEntityId,
        operatorEntityId: tx.operatorEntityId,
        currency: tx.currency,
        amount: tx.amount,
        category: tx.category ?? undefined,
        subCategory: tx.subCategory ?? undefined,
      },
    });
  };

  const inputRef = useNumberFormat({ locales: "es-AR" });

  return (
    <Dialog open={isOpen} onOpenChange={() => reset()}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          type="button"
          disabled={!tx.isUpdateAllowed}
          onClick={() => setIsOpen(true)}
          className="rounded-full border-2 border-transparent bg-transparent p-2"
        >
          <Icons.editing className="h-6 text-black dark:text-white" />
        </Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={() => setIsOpen(false)}
        className="sm:max-w-[1000px]"
      >
        <DialogHeader>
          <div className="flex w-full flex-row justify-between">
            <DialogTitle>Transacción {tx.id}</DialogTitle>
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsOpen(false)}
              >
                Cerrar
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div>
          <Form {...form}>
            <form
              onSubmit={(e) => {
                e.stopPropagation();
                void handleSubmit(onSubmit)(e);
              }}
              className="flex flex-col space-y-2"
            >
              <div className="grid grid-cols-6">
                <div className="col-span-1 flex flex-row items-center space-x-4">
                  <FormField
                    control={control}
                    name="operatorEntityId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Operador</FormLabel>
                        {entities && (
                          <>
                            <CustomSelector
                              data={entities.map((entity) => ({
                                value: entity.id.toString(),
                                label: entity.name,
                              }))}
                              field={field}
                              fieldName="operatorEntityId"
                              placeholder="Elegir"
                            />
                            {watchOperatorEntity && (
                              <EntityCard
                                entity={
                                  entities.find(
                                    (e) =>
                                      e.id.toString() === watchOperatorEntity,
                                  ) ?? tx.operatorEntity
                                }
                                disableLinks={true}
                              />
                            )}
                          </>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button type="button" variant="link">
                        <Icons.info className="h-8" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent>
                      <p>
                        Cargado por:{" "}
                        <span>
                          {tx.transactionMetadata?.uploadedByUser?.name}
                        </span>{" "}
                      </p>
                      {tx.transactionMetadata?.confirmedByUser && (
                        <p>
                          Confirmado por:{" "}
                          <span>
                            {tx.transactionMetadata?.confirmedByUser?.name}
                          </span>{" "}
                        </p>
                      )}
                    </HoverCardContent>
                  </HoverCard>
                </div>
                <div className="col-span-5">
                  <div className="grid grid-cols-3">
                    <div className="justify-self-end">
                      <FormField
                        control={control}
                        name="fromEntityId"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Origen</FormLabel>
                            {entities && (
                              <>
                                <CustomSelector
                                  data={entities.map((entity) => ({
                                    value: entity.id.toString(),
                                    label: entity.name,
                                  }))}
                                  field={field}
                                  fieldName="fromEntityId"
                                  placeholder="Elegir"
                                />
                                {watchFromEntity && (
                                  <EntityCard
                                    entity={
                                      entities.find(
                                        (e) =>
                                          e.id.toString() === watchFromEntity,
                                      ) ?? tx.fromEntity
                                    }
                                    disableLinks={true}
                                  />
                                )}
                              </>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-4 justify-self-center">
                      <div className="flex flex-col items-center justify-center gap-y-1">
                        <Label>Divisa</Label>
                        <FormField
                          control={control}
                          name="currency"
                          render={({ field }) => (
                            <FormItem>
                              <CustomSelector
                                buttonClassName="w-[60px]"
                                data={currencies}
                                field={field}
                                fieldName="currency"
                                placeholder="Elegir"
                              />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex flex-col items-center justify-center gap-y-1">
                        <Label>Monto</Label>
                        <FormField
                          control={control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  ref={inputRef}
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
                      {tx.type === "gasto" && (
                        <div className="flex flex-col items-center space-y-2">
                          <Label>Categoria</Label>
                          <FormField
                            control={control}
                            name={"subCategory"}
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
                                      setValue("category", value);
                                      field.onChange(subValue);
                                    } else {
                                      setValue("category", undefined);
                                      field.onChange(null);
                                    }
                                  }}
                                  selectedValue={watch("category")}
                                  selectedSubValue={field.value}
                                />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                    <FormField
                      control={control}
                      name="toEntityId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Origen</FormLabel>
                          {entities && (
                            <>
                              <CustomSelector
                                data={entities.map((entity) => ({
                                  value: entity.id.toString(),
                                  label: entity.name,
                                }))}
                                field={field}
                                fieldName="toEntityId"
                                placeholder="Elegir"
                              />
                              {watchToEntity && (
                                <EntityCard
                                  entity={
                                    entities.find(
                                      (e) => e.id.toString() === watchToEntity,
                                    ) ?? tx.toEntity
                                  }
                                  disableLinks={true}
                                />
                              )}
                            </>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              <div className="flex w-full items-center justify-end space-x-8">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => reset()}
                  className="mt-4 flex flex-row items-center justify-center space-x-2 p-2"
                >
                  Resetear <Icons.undo className="ml-2 h-8" />
                </Button>
                <Button className="mt-4" type="submit" disabled={isLoading}>
                  {isLoading ? "Modificando..." : "Modificar transacción"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateTransaction;
