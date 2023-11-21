"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createQueryString } from "~/lib/functions";
import type { RouterOutputs } from "~/trpc/shared";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import CustomSelector from "./CustomSelector";

const FormSchema = z.object({
  operationId: z.string().optional(),
  opDay: z.date().optional(),
  opDateIsGreater: z.date().optional(),
  opDateIsLesser: z.date().optional(),
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
});

interface FilterOperationsFormProps {
  entities: RouterOutputs["entities"]["getAll"];
}

const FilterOperationsForm = ({ entities }: FilterOperationsFormProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
  });

  const { control, reset, watch } = form;

  const watchFromEntityId = watch("fromEntityId")!;

  useEffect(() => {
    if (watchFromEntityId !== undefined) {
      router.push(
        pathname +
          "?" +
          createQueryString(searchParams, "origen", watchFromEntityId),
      );
    }
  }, [pathname, searchParams, router, watchFromEntityId]);

  return (
    <Form {...form}>
      <form className="flex flex-row justify-between">
        <div className="flex flex-row justify-start">
          <FormField
            control={control}
            name="fromEntityId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Entidad de origen</FormLabel>
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
        </div>
        <Link
          onClick={() => reset()}
          href={{
            pathname: pathname,
            query: { pagina: "1" },
          }}
        >
          Resetear
        </Link>
      </form>
    </Form>
  );
};

export default FilterOperationsForm;
