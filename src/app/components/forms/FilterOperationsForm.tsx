"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import moment from "moment";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  isNumeric,
} from "~/lib/functions";
import { currencies, dateFormatting, operationTypes } from "~/lib/variables";
import type { RouterOutputs } from "~/trpc/shared";
import { DateRangePicker } from "../DateRangePicker";
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
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import CustomSelector from "./CustomSelector";
import Link from "next/link";

const FormSchema = z.object({
  operationId: z.string().optional(),
  opDateRange: z
    .object({
      from: z.date(),
      to: z.date().optional(),
    })
    .optional(),
  transactionId: z.number().optional(),
  transactionType: z.string().optional(),
  transactionDate: z.date().optional(),
  operatorEntityId: z.array(z.string()).optional(),
  entityId: z.array(z.string()).optional(),
  fromEntityId: z.array(z.string()).optional(),
  toEntityId: z.array(z.string()).optional(),
  currency: z.string().optional(),
  method: z.string().optional(),
  status: z.boolean().optional(),
  uploadedById: z.string().optional(),
  confirmedById: z.string().optional(),
  amount: z
    .string()
    .optional()
    .refine((value) => value === undefined || isNumeric(value)),
  amountFilterType: z.enum(["equal", "gte", "lte"]).default("equal"),
});

interface FilterOperationsFormProps {
  entities: RouterOutputs["entities"]["getAll"];
  users: RouterOutputs["users"]["getAll"];
}

const FilterOperationsForm = ({
  entities,
  users,
}: FilterOperationsFormProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedDateGreater = searchParams.get("diaDesde") ?? undefined;
  const selectedDateLesser = searchParams.get("diaHasta") ?? undefined;
  const selectedTransactionType = searchParams.get("tipo") ?? undefined;
  const selectedOperator = searchParams.getAll("operador") ?? undefined;
  const selectedEntity = searchParams.getAll("entidad") ?? undefined;
  const selectedFromEntity = searchParams.getAll("origen") ?? undefined;
  const selectedToEntity = searchParams.getAll("destino") ?? undefined;
  const selectedCurrency = searchParams.get("divisa") ?? undefined;
  const selectedAmount = searchParams.get("monto") ?? undefined;
  const selectedMinAmount = searchParams.get("montoMin") ?? undefined;
  const selectedMaxAmount = searchParams.get("montoMax") ?? undefined;
  const selectedUploadUserId = searchParams.get("cargadoPor") ?? undefined;
  const selectedConfirmationUserId =
    searchParams.get("confirmadoPor") ?? undefined;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    defaultValues: {
      opDateRange: selectedDateGreater
        ? {
          from: moment(selectedDateGreater, dateFormatting.day).toDate(),
          to: selectedDateGreater
            ? moment(selectedDateLesser, dateFormatting.day).toDate()
            : undefined,
        }
        : undefined,
      transactionType: selectedTransactionType,
      operatorEntityId: selectedOperator,
      entityId: selectedEntity,
      fromEntityId: selectedFromEntity,
      toEntityId: selectedToEntity,
      currency: selectedCurrency,
      amount: selectedAmount ?? selectedMaxAmount ?? selectedMinAmount ?? undefined,
      amountFilterType: selectedAmount
        ? "equal"
        : selectedMaxAmount
          ? "lte"
          : selectedMinAmount
            ? "gte"
            : "equal",
      uploadedById: selectedUploadUserId,
      confirmedById: selectedConfirmationUserId,
    },
  });

  const { control, reset, watch } = form;

  const watchEntityId = watch("entityId");
  const watchFromEntityId = watch("fromEntityId");
  const watchToEntityId = watch("toEntityId");
  const watchCurrency = watch("currency");
  const watchOpDateRange = watch("opDateRange");
  const watchTxType = watch("transactionType");
  const watchOperator = watch("operatorEntityId");
  const watchAmount = watch("amount");
  const watchAmountFilterType = watch("amountFilterType");
  const watchUploadUserId = watch("uploadedById");
  const watchConfirmedUserId = watch("confirmedById");

  interface UrlParams {
    entidad?: typeof watchEntityId;
    origen?: typeof watchFromEntityId;
    destino?: typeof watchToEntityId;
    divisa?: typeof watchCurrency;
    diaDesde?: string | undefined;
    diaHasta?: string | undefined;
    monto?: typeof watchAmount;
    montoMin?: typeof watchAmount;
    montoMax?: typeof watchAmount;
    tipo?: typeof watchTxType;
    operador?: typeof watchOperator;
    cargadorPor?: typeof watchUploadUserId;
    confirmadoPor?: typeof watchConfirmedUserId;
  }

  function arraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }

  const updateUrl = useCallback(
    (params: UrlParams) => {
      const updatedSearchParams = new URLSearchParams(searchParams);

      Object.entries(params).forEach(([paramName, paramValue]) => {
        const currentValue = updatedSearchParams.getAll(paramName);

        if (paramValue === undefined) {
          if (currentValue.length > 0) {
            currentValue.forEach(() => {
              updatedSearchParams.delete(paramName);
              updatedSearchParams.set("pagina", "1")
            });
          }
        } else {
          if (Array.isArray(paramValue)) {
            if (!arraysEqual(currentValue, paramValue)) {
              paramValue.forEach(value => {
                updatedSearchParams.append(paramName, value);
                updatedSearchParams.set("pagina", "1")
              });
            }
          } else {
            if (currentValue[0] !== paramValue) {
              updatedSearchParams.set(paramName, paramValue);
              updatedSearchParams.set("pagina", "1")
            }
          }
        }
      });

      router.push(pathname + "?" + updatedSearchParams.toString());
    },
    [pathname, searchParams, router],
  );


  useEffect(() => {
    updateUrl({
      entidad: watchEntityId,
      origen: watchFromEntityId,
      destino: watchToEntityId,
      divisa: watchCurrency,
      diaDesde:
        watchOpDateRange?.from && moment(watchOpDateRange.from).isValid()
          ? moment(watchOpDateRange.from).format(dateFormatting.day)
          : undefined,
      diaHasta:
        watchOpDateRange?.to && moment(watchOpDateRange.to).isValid()
          ? moment(watchOpDateRange.to).format(dateFormatting.day)
          : undefined,
      monto:
        watchAmountFilterType === "equal" && watchAmount
          ? watchAmount
          : undefined,
      montoMin:
        watchAmountFilterType === "gte" && watchAmount
          ? watchAmount
          : undefined,
      montoMax:
        watchAmountFilterType === "lte" && watchAmount
          ? watchAmount
          : undefined,
      tipo: watchTxType,
      operador: watchOperator,
      cargadorPor: watchUploadUserId,
      confirmadoPor: watchConfirmedUserId,
    });
  }, [
    watchEntityId,
    watchFromEntityId,
    watchToEntityId,
    watchCurrency,
    watchOpDateRange,
    watchTxType,
    watchOperator,
    watchAmount,
    watchAmountFilterType,
    watchConfirmedUserId,
    watchUploadUserId,
    updateUrl,
  ]);

  return (
    <Form {...form}>
      <form className="flex flex-col space-y-4">
        <div className="flex flex-row flex-wrap items-start justify-start gap-x-4 gap-y-2">
          <FormField
            control={control}
            name="entityId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Entidad</FormLabel>
                {entities && (
                  <CustomSelector
                    data={entities.map((entity) => ({
                      value: entity.id.toString(),
                      label: entity.name,
                    }))}
                    field={field}
                    fieldName="entityId"
                    placeholder="Elegir"
                    isMultiSelect={true}
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="fromEntityId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Origen</FormLabel>
                {entities && (
                  <CustomSelector
                    data={entities.map((entity) => ({
                      value: entity.id.toString(),
                      label: entity.name,
                    }))}
                    field={field}
                    fieldName="fromEntityId"
                    placeholder="Elegir"
                    isMultiSelect={true}
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="toEntityId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Destino</FormLabel>
                {entities && (
                  <CustomSelector
                    data={entities.map((entity) => ({
                      value: entity.id.toString(),
                      label: entity.name,
                    }))}
                    field={field}
                    fieldName="toEntityId"
                    placeholder="Elegir"
                    isMultiSelect={true}
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="operatorEntityId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Operador</FormLabel>
                {entities && (
                  <CustomSelector
                    data={entities.map((entity) => ({
                      value: entity.id.toString(),
                      label: entity.name,
                    }))}
                    field={field}
                    fieldName="operatorEntityId"
                    placeholder="Elegir"
                    isMultiSelect={true}
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="currency"
            render={({ field }) => (
              <FormItem className="flex flex-col">
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
          <div className="flex flex-col justify-center space-y-2">
            <FormField
              control={control}
              name="amount"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input type="number" className="w-32" placeholder="$" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="amountFilterType"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <ToggleGroupItem value="equal" aria-label="Toggle equal">
                        <Icons.equal className="h-4" />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="gte" aria-label="Toggle gte">
                        <Icons.gte className="h-4" />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="lte" aria-label="Toggle lte">
                        <Icons.lte className="h-4" />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={control}
            name="transactionType"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Tipo</FormLabel>
                <CustomSelector
                  buttonClassName="w-18"
                  data={operationTypes}
                  field={field}
                  fieldName="transactionType"
                  placeholder="Elegir"
                />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="opDateRange"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha</FormLabel>
                <DateRangePicker date={field.value} setDate={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="uploadedById"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Cargado por</FormLabel>
                <CustomSelector
                  buttonClassName="w-32"
                  data={users.map((user) => ({
                    value: user.id,
                    label: user.name!,
                  }))}
                  field={field}
                  fieldName="uploadedById"
                  placeholder="Elegir"
                />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="confirmedById"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Confirmado por</FormLabel>
                <CustomSelector
                  buttonClassName="w-32"
                  data={users.map((user) => ({
                    value: user.id,
                    label: user.name!,
                  }))}
                  field={field}
                  fieldName="confirmedById"
                  placeholder="Elegir"
                />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-row justify-start">
          <Link href={"/operaciones/gestion"}>
            <Button variant="outline" onClick={() => reset({ amount: "", amountFilterType: "equal" })}>
              Resetear filtros <Icons.undo className="ml-2 h-5" />
            </Button>
          </Link>
        </div>
      </form>
    </Form>
  );
};

export default FilterOperationsForm;
