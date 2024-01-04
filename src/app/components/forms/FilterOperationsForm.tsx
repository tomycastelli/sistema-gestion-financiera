"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import moment from "moment";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  createQueryString,
  isNumeric,
  removeQueryString,
} from "~/lib/functions";
import { cn } from "~/lib/utils";
import { currencies, operationTypes } from "~/lib/variables";
import type { RouterOutputs } from "~/trpc/shared";
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
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import CustomSelector from "./CustomSelector";

const FormSchema = z.object({
  operationId: z.string().optional(),
  opDay: z.date().optional(),
  opDayFilterType: z.enum(["equal", "gte", "lte"]).default("equal"),
  transactionId: z.number().optional(),
  transactionType: z.string().optional(),
  transactionDate: z.date().optional(),
  operatorEntityId: z.string().optional(),
  fromEntityId: z.string().optional(),
  toEntityId: z.string().optional(),
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

  const selectedDate = searchParams.get("dia");
  const selectedDateGreater = searchParams.get("diaMin");
  const selectedDateLesser = searchParams.get("diaMax");
  const selectedTransactionType = searchParams.get("tipo");
  const selectedOperator = searchParams.get("operador");
  const selectedFromEntity = searchParams.get("origen");
  const selectedToEntity = searchParams.get("destino");
  const selectedCurrency = searchParams.get("divisa");
  const selectedAmount = searchParams.get("monto");
  const selectedMinAmount = searchParams.get("montoMin");
  const selectedMaxAmount = searchParams.get("montoMax");
  const selectedUploadUserId = searchParams.get("cargadoPor");
  const selectedConfirmationUserId = searchParams.get("confirmadoPor");

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    defaultValues: {
      opDay: selectedDate
        ? moment(selectedDate, "DD-MM-YYYY").toDate()
        : selectedDateGreater
          ? moment(selectedDateGreater, "DD-MM-YYYY").toDate()
          : selectedDateLesser
            ? moment(selectedDateLesser, "DD-MM-YYYY").toDate()
            : undefined,
      opDayFilterType: selectedDate
        ? "equal"
        : selectedDateGreater
          ? "gte"
          : selectedDateLesser
            ? "lte"
            : "equal",
      transactionType: selectedTransactionType
        ? selectedTransactionType
        : undefined,
      operatorEntityId: selectedOperator ? selectedOperator : undefined,
      fromEntityId: selectedFromEntity ? selectedFromEntity : undefined,
      toEntityId: selectedToEntity ? selectedToEntity : undefined,
      currency: selectedCurrency ? selectedCurrency : undefined,
      amount: selectedAmount
        ? selectedAmount
        : selectedMaxAmount
          ? selectedMaxAmount
          : selectedMinAmount
            ? selectedMinAmount
            : undefined,
      amountFilterType: selectedAmount
        ? "equal"
        : selectedMaxAmount
          ? "lte"
          : selectedMinAmount
            ? "gte"
            : "equal",
      uploadedById: selectedUploadUserId ? selectedUploadUserId : undefined,
      confirmedById: selectedConfirmationUserId
        ? selectedConfirmationUserId
        : undefined,
    },
  });

  const { control, reset, watch } = form;

  const watchFromEntityId = watch("fromEntityId")!;
  const watchToEntityId = watch("toEntityId")!;
  const watchCurrency = watch("currency");
  const watchOpDay = watch("opDay");
  const watchTxType = watch("transactionType");
  const watchOperator = watch("operatorEntityId");
  const watchAmount = watch("amount");
  const watchAmountFilterType = watch("amountFilterType");
  const watchOpDayFilterType = watch("opDayFilterType");
  const watchUploadUserId = watch("uploadedById");
  const watchConfirmedUserId = watch("confirmedById");

  useEffect(() => {
    if (watchFromEntityId !== undefined) {
      router.push(
        pathname +
        "?" +
        createQueryString(searchParams, "origen", watchFromEntityId),
      );
    }
    if (watchToEntityId !== undefined) {
      router.push(
        pathname +
        "?" +
        createQueryString(searchParams, "destino", watchToEntityId),
      );
    }
    if (watchCurrency !== undefined) {
      router.push(
        pathname +
        "?" +
        createQueryString(searchParams, "divisa", watchCurrency),
      );
    }
    if (watchOpDay) {
      if (watchOpDayFilterType === "equal") {
        router.push(
          pathname +
          "?" +
          createQueryString(
            new URLSearchParams(
              removeQueryString(searchParams, ["diaMax", "diaMin"]),
            ),
            "dia",
            moment(watchOpDay).format("DD-MM-YYYY"),
          ),
        );
      } else if (watchOpDayFilterType === "gte") {
        router.push(
          pathname +
          "?" +
          createQueryString(
            new URLSearchParams(
              removeQueryString(searchParams, ["diaMax", "dia"]),
            ),
            "diaMin",
            moment(watchOpDay).format("DD-MM-YYYY"),
          ),
        );
      } else if (watchOpDayFilterType === "lte") {
        router.push(
          pathname +
          "?" +
          createQueryString(
            new URLSearchParams(
              removeQueryString(searchParams, ["diaMin", "dia"]),
            ),
            "diaMax",
            moment(watchOpDay).format("DD-MM-YYYY"),
          ),
        );
      }
    }
    if (watchTxType) {
      router.push(
        pathname + "?" + createQueryString(searchParams, "tipo", watchTxType),
      );
    }
    if (watchOperator) {
      router.push(
        pathname +
        "?" +
        createQueryString(searchParams, "operador", watchOperator),
      );
    }
    if (watchAmount && isNumeric(watchAmount)) {
      if (watchAmountFilterType === "equal") {
        router.push(
          pathname +
          "?" +
          createQueryString(
            new URLSearchParams(
              removeQueryString(searchParams, ["montoMin", "montoMax"]),
            ),
            "monto",
            watchAmount,
          ),
        );
      } else if (watchAmountFilterType === "gte") {
        router.push(
          pathname +
          "?" +
          createQueryString(
            new URLSearchParams(
              removeQueryString(searchParams, ["monto", "montoMax"]),
            ),
            "montoMin",
            watchAmount,
          ),
        );
      } else if (watchAmountFilterType === "lte") {
        router.push(
          pathname +
          "?" +
          createQueryString(
            new URLSearchParams(
              removeQueryString(searchParams, ["montoMin", "monto"]),
            ),
            "montoMax",
            watchAmount,
          ),
        );
      }
    }
    if (watchUploadUserId) {
      router.push(
        pathname +
        "?" +
        createQueryString(searchParams, "cargadoPor", watchUploadUserId),
      );
    }
    if (watchConfirmedUserId) {
      router.push(
        pathname +
        "?" +
        createQueryString(
          searchParams,
          "confirmadoPor",
          watchConfirmedUserId,
        ),
      );
    }
  }, [
    pathname,
    searchParams,
    router,
    watchFromEntityId,
    watchToEntityId,
    watchCurrency,
    watchOpDay,
    watchOpDayFilterType,
    watchTxType,
    watchOperator,
    watchAmount,
    watchAmountFilterType,
    watchConfirmedUserId,
    watchUploadUserId,
  ]);

  return (
    <Form {...form}>
      <form className="flex flex-col space-y-4">
        <div className="flex flex-row flex-wrap items-start justify-start space-x-4 space-y-6">
          <FormField
            control={control}
            name="fromEntityId"
            render={({ field }) => (
              <FormItem className="mt-6 flex flex-col">
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
                    <Input className="w-32" placeholder="$" {...field} />
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
          <div className="flex flex-col justify-center space-y-2">
            <FormField
              control={form.control}
              name="opDay"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-32 pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            moment(field.value).format("DD-MM-YYYY")
                          ) : (
                            <span>Elegir</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
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
              name="opDayFilterType"
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
          <Link
            prefetch={false}
            onClick={() => reset({ amount: "", amountFilterType: "equal" })}
            href={{
              pathname: "/operaciones/gestion",
              query: { pagina: "1" },
            }}
          >
            <Button variant="outline">
              Resetear filtros <Icons.undo className="ml-2 h-5" />
            </Button>
          </Link>
        </div>
      </form>
    </Form>
  );
};

export default FilterOperationsForm;
