"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { type ChangeEvent, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Icons } from "~/app/components/ui/Icons"

import { Button } from "~/app/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/app/components/ui/form"
import { Input } from "~/app/components/ui/input"
import { Textarea } from "~/app/components/ui/textarea"
import { safeJsonParse } from "~/lib/functions"
import { api } from "~/trpc/react"
import OperationPreview from "./OperationPreview"
import { type RouterOutputs } from "~/trpc/shared"
import CustomPagination from "~/app/components/CustomPagination"

const insertOpSchema = z.object({
  opDate: z.string().transform(str => new Date(str)),
  opObservations: z.string().optional(),
  opId: z.number().int().optional().nullable(),
  transactions: z.array(
    z.object({
      type: z.string(),
      operatorEntityId: z.number().int(),
      fromEntityId: z.number().int(),
      toEntityId: z.number().int(),
      currency: z.string(),
      amount: z.number().positive(),
      method: z.string().optional(),
      metadata: z
        .object({ exchangeRate: z.number().optional() })
        .optional(),
      status: z.string()
    }),
  ),
})

const FormSchema = z.object({
  manualJsonString: z
    .string().min(1, { message: "JSON vacío" }).superRefine((val, ctx) => {
      const data = safeJsonParse(val)
      if (data === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El JSON no tiene un formato válido",
        })
      }
      const parsedData = z.array(insertOpSchema).safeParse(data)
      if (!parsedData.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: parsedData.error.message
        })
      }
    }).optional(),
  fileJsonString: z.string().min(1, { message: "JSON vacío" }).superRefine((val, ctx) => {
    const data = safeJsonParse(val)
    if (data === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El JSON no tiene un formato válido",
      })
    }
    const parsedData = z.array(insertOpSchema).safeParse(data)
    if (!parsedData.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: parsedData.error.message
      })
    }
  }).optional()
}).superRefine((val, ctx) => {
  if (!val.fileJsonString && !val.manualJsonString) {
    ctx.addIssue({
      code: "invalid_type",
      expected: "string",
      received: "undefined",
      message: "No se recibió un JSON en texto o archivo"
    })
  }
})

export function CargaRapida() {
  const [loadedOperations, setLoadedOperations] = useState<RouterOutputs["operations"]["insertOperation"][]>([])
  const [loadedOperationsPage, setLoadedOperatonsPage] = useState<number>(1)

  const { mutateAsync, isLoading, isError } = api.operations.insertOperation.useMutation({
    onError(error, variables) {
      toast.error(`No se pudo cargar la operación con fecha ${variables.opDate.toDateString()}`, {
        description: error.message
      })
    },
    onSuccess(data) {
      setLoadedOperations(prev => prev.concat(data))
    },
  })

  const { mutateAsync: updateAsync } = api.editingOperations.updateTransactionStatus.useMutation({
    onError(err, variables) {
      toast.error(`No se puede confirmar las tx ${variables.transactionIds.join(", ")}`, {
        description: err.message
      })
    }
  })

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  })

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    const json = data.manualJsonString ? safeJsonParse(data.manualJsonString) : safeJsonParse(data.fileJsonString!)
    const parsedJson = z.array(insertOpSchema).safeParse(json)
    if (parsedJson.success) {
      for (const op of parsedJson.data) {
        if (isError) {
          break
        }
        const response = await mutateAsync(op)
        const txsToUpdate = response.transactions.filter(tx => tx.type === "cambio" && tx.status === "confirmed")
        if (txsToUpdate.length > 0) {
          await updateAsync({ transactionIds: txsToUpdate.map(tx => tx.id) })
        }
      }
    }
  }

  const handleUploadedFile = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      toast.error("No se cargó el archivo")
      return
    }

    const file = event.target.files[0]

    if (!file) {
      toast.error("No se cargó el archivo")
      return
    }

    const reader = new FileReader();

    reader.readAsText(file, "UTF-8");



    reader.onload = e => {
      const content = e.target?.result
      if (typeof content === "string") {
        form.setValue("fileJsonString", content)
      }
    }

  }

  const watchFileJson = form.watch("fileJsonString")

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto gap-y-6 flex flex-col">
          <FormField
            control={form.control}
            name="fileJsonString"
            render={() => (
              <FormItem>
                <FormControl>
                  <Input type="file" accept=".json" placeholder="Archivo JSON" onChange={handleUploadedFile} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {watchFileJson && (
            <div className="flex flex-row gap-x-1">
              <Icons.check className="h-5 w-5 text-green" />
              <p>JSON cargado</p>
            </div>
          )}
          <FormField
            control={form.control}
            name="manualJsonString"
            render={({ field }) => (
              <FormItem>
                <FormLabel>JSON</FormLabel>
                <FormControl>
                  <Textarea
                    className="resize-none h-36 w-full"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  La carga de operaciones puede tardar dependiendo de la cantidad ingresada
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading}>{isLoading ? "Cargando operaciones..." : "Cargar"}</Button>
        </form>
      </Form>
      {loadedOperations.length > 0 && (
        <div className="flex flex-col justify-start gap-y-2">
          <h1 className="text-2xl font-semibold">Operaciones cargadas</h1>
          <div className="grid grid-cols-2 gap-4">
            {loadedOperations.slice((loadedOperationsPage - 1) * 4, loadedOperationsPage * 4).map(op => (
              <OperationPreview key={op.operation.id} op={op} />
            ))}
          </div>
          <CustomPagination page={loadedOperationsPage} itemName="operaciones" pageSize={4} changePageState={setLoadedOperatonsPage} totalCount={loadedOperations.length} />
        </div>
      )}
    </div>
  )
}
