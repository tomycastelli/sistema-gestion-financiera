"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cn } from "~/lib/utils";
import { currencies, paymentMethods } from "~/lib/variables";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import EntityCard from "../ui/EntityCard";
import { Icons } from "../ui/Icons";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import { useToast } from "../ui/use-toast";
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
  method: z.string().optional(),
});

const UpdateTransaction = ({
  transaction: tx,
  entities,
  operationsQueryInput,
}: UpdateTransactionProps) => {
  const { toast } = useToast();
  const [differingKeysCount, setDifferingKeysCount] = useState(0);
  const utils = api.useContext();
  const [isOpen, setIsOpen] = useState(false);

  const { mutate } = api.editingOperations.updateTransactionValues.useMutation({
    async onMutate(newOperation) {
      setIsOpen(false);
      reset({
        fromEntityId: newOperation.newTransactionData.fromEntityId.toString(),
        toEntityId: newOperation.newTransactionData.toEntityId.toString(),
        operatorEntityId:
          newOperation.newTransactionData.operatorEntityId.toString(),
        currency: newOperation.newTransactionData.currency,
        amount: newOperation.newTransactionData.amount.toString(),
        method: newOperation.newTransactionData.method
          ? newOperation.newTransactionData.method
          : undefined,
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
                  method: newOperation.newTransactionData.method
                    ? newOperation.newTransactionData.method
                    : null,
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
      toast({
        title: "No se pudieron actualizar las transacciones",
        description: `${JSON.stringify(err.data)}`,
        variant: "destructive",
      });
      return { prevData };
    },
    onSettled() {
      void utils.operations.getOperations.invalidate();
    },
  });

  const defaultTxValues = useMemo(
    () => ({
      fromEntityId: tx.fromEntityId.toString(),
      toEntityId: tx.toEntityId.toString(),
      operatorEntityId: tx.operatorEntityId.toString(),
      currency: tx.currency,
      amount: tx.amount.toString(),
      method: tx.method ? tx.method : undefined,
    }),
    [
      tx.amount,
      tx.currency,
      tx.fromEntityId,
      tx.method,
      tx.operatorEntityId,
      tx.toEntityId,
    ],
  );

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: defaultTxValues,
  });

  const { handleSubmit, control, watch, reset } = form;

  const watchFromEntity = watch("fromEntityId");
  const watchToEntity = watch("toEntityId");
  const watchOperatorEntity = watch("operatorEntityId");
  const watchCurrency = watch("currency");
  const watchAmount = watch("amount");
  const watchMethod = watch("method");

  const watchObject = useMemo(() => {
    return {
      fromEntityId: watchFromEntity,
      toEntityId: watchToEntity,
      operatorEntityId: watchOperatorEntity,
      currency: watchCurrency,
      amount: watchAmount,
      method: watchMethod,
    };
  }, [
    watchFromEntity,
    watchToEntity,
    watchOperatorEntity,
    watchCurrency,
    watchAmount,
    watchMethod,
  ]);

  useEffect(() => {
    const countChangedFields = () => {
      const differingKeys = Object.keys(defaultTxValues).reduce((acc, key) => {
        return defaultTxValues[
          key as keyof typeof defaultTxValues
        ]?.toString() !==
          watchObject[key as keyof typeof defaultTxValues]?.toString()
          ? acc + 1
          : acc;
      }, 0);

      setDifferingKeysCount(differingKeys);
    };

    countChangedFields();
  }, [watchObject, defaultTxValues]);

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    mutate({
      txId: tx.id,
      newTransactionData: {
        fromEntityId: parseInt(values.fromEntityId),
        toEntityId: parseInt(values.toEntityId),
        operatorEntityId: parseInt(values.operatorEntityId),
        currency: values.currency,
        amount: parseFloat(values.amount),
        method: values.method,
      },
      oldTransactionData: {
        fromEntityId: tx.fromEntityId,
        toEntityId: tx.toEntityId,
        operatorEntityId: tx.operatorEntityId,
        currency: tx.currency,
        amount: tx.amount,
        method: tx.method ? tx.method : undefined,
      },
    });

    console.log(values);
    toast({
      title: `Transacción ${tx.id} editada`,
      description: `${differingKeysCount} atributos modificados`,
      variant: "success",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => reset()}>
      <DialogTrigger asChild>
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className={cn(
            "rounded-full border-2 border-transparent bg-transparent p-2 hover:bg-muted",
          )}
        >
          <Icons.editing className="h-6 text-black" />
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
          <DialogDescription>
            {tx.date?.toLocaleDateString("es-AR")}
          </DialogDescription>
        </DialogHeader>
        <div>
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col space-y-2"
            >
              <div className="grid grid-cols-4">
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
                              <EntityCard entity={tx.operatorEntity} />
                            )}
                          </>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        type="button"
                        variant="link"
                        className="text-black"
                      >
                        <Icons.info className="h-8" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent>
                      <p>
                        Cargado por:{" "}
                        <span>
                          {tx.transactionMetadata?.uploadedByUser.name}
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
                <div className="col-span-3">
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
                                  <EntityCard entity={tx.fromEntity} />
                                )}
                              </>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-2 justify-self-center">
                      <div className="flex flex-row items-center justify-center space-x-2">
                        <FormField
                          control={control}
                          name="currency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Divisa</FormLabel>
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
                        <FormField
                          control={control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monto</FormLabel>
                              <FormControl>
                                <Input
                                  className="w-32"
                                  placeholder="$"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={control}
                        name="method"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Método</FormLabel>
                            <CustomSelector
                              data={paymentMethods}
                              field={field}
                              fieldName="method"
                              placeholder="Elegir"
                            />
                          </FormItem>
                        )}
                      />
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
                                <EntityCard entity={tx.toEntity} />
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
                  disabled={differingKeysCount === 0}
                  variant="outline"
                  type="button"
                  onClick={() => reset()}
                  className="mt-4 flex flex-row items-center justify-center space-x-2 p-2 text-black"
                >
                  Resetear <Icons.undo className="ml-2 h-8" />
                </Button>
                <Button
                  className="mt-4"
                  type="submit"
                  disabled={differingKeysCount === 0}
                >
                  Modificar transacción ({differingKeysCount})
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
