"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import CustomSelector from "../components/forms/CustomSelector";
import EntityCard from "../components/ui/EntityCard";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";

interface ChangeEntityFormProps {
  entity: RouterOutputs["entities"]["getAll"][number];
  entities: RouterOutputs["entities"]["getAll"];
  tags: RouterOutputs["tags"]["getFiltered"];
}

const FormSchema = z.object({
  name: z.string(),
  sucursalOrigen: z.number().int().optional(),
  operadorAsociado: z.number().int().optional(),
});

const ChangeEntityForm = ({
  entity,
  tags,
  entities,
}: ChangeEntityFormProps) => {
  const utils = api.useContext();

  const { mutateAsync } = api.entities.updateOne.useMutation({
    async onMutate(newOperation) {
      // Doing the Optimistic update
      await utils.entities.getAll.cancel();

      const prevData = utils.entities.getAll.getData();

      utils.entities.getAll.setData(undefined, (old) => {
        if (!old) {
          return [];
        }
        const tagObj = tags.find((t) => t.name === newOperation.name);
        const sucursalOrigenObj = entities.find(
          (e) => e.id === newOperation.sucursalOrigen,
        );
        const operadorAsociadoObj = entities.find(
          (e) => e.id === newOperation.operadorAsociado,
        );
        return old.map((obj) =>
          obj.id === newOperation.id && tagObj
            ? {
                id: obj.id,
                name: newOperation.name,
                tag: tagObj,
                sucursalOrigenEntity: sucursalOrigenObj
                  ? {
                      id: sucursalOrigenObj.id,
                      name: sucursalOrigenObj.name,
                      tag: sucursalOrigenObj.tag,
                      tagName: sucursalOrigenObj.tag.name,
                      sucursalOrigen:
                        sucursalOrigenObj.sucursalOrigenEntity?.id ?? null,
                      operadorAsociado:
                        sucursalOrigenObj.operadorAsociadoEntity?.id ?? null,
                    }
                  : null,
                operadorAsociadoEntity: operadorAsociadoObj
                  ? {
                      id: operadorAsociadoObj.id,
                      name: operadorAsociadoObj.name,
                      tag: operadorAsociadoObj.tag,
                      tagName: operadorAsociadoObj.tag.name,
                      sucursalOrigen:
                        operadorAsociadoObj.sucursalOrigenEntity?.id ?? null,
                      operadorAsociado:
                        operadorAsociadoObj.operadorAsociadoEntity?.id ?? null,
                    }
                  : null,
              }
            : obj,
        );
      });

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.entities.getAll.setData(undefined, ctx?.prevData);

      toast.error(`No se pudo cargar la entidad ${newOperation.id}`, {
        description: err.message,
      });
    },
    onSettled() {
      void utils.entities.getAll.invalidate();
    },
    onSuccess(data) {
      toast.success(`Entidad ${data.id} modificada`);
    },
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: entity.name,
      sucursalOrigen: entity.sucursalOrigenEntity?.id,
      operadorAsociado: entity.operadorAsociadoEntity?.id,
    },
  });

  const { handleSubmit, control, watch } = form;

  const watchOperadorAsociado = watch("operadorAsociado");
  const watchSucursalOrigen = watch("sucursalOrigen");

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    await mutateAsync({
      id: entity.id,
      name: data.name,
      tagName: entity.tag.name,
      sucursalOrigen: data.sucursalOrigen,
      operadorAsociado: data.operadorAsociado,
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex flex-row items-center justify-center border-transparent p-1"
        >
          <p className="mr-1">Editar</p>
          <Icons.editing className="h-6 text-green" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Editar entidad {entity.id}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {entity.tag.name === "Clientes" && (
                <div className="flex w-full flex-row items-start justify-start gap-x-2">
                  <FormField
                    control={control}
                    name="operadorAsociado"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Operador asociado</FormLabel>
                        <CustomSelector
                          data={entities
                            .filter(
                              (entity) => entity.tag.name === "Operadores",
                            )
                            .map((entity) => ({
                              value: entity.id,
                              label: entity.name,
                            }))}
                          field={field}
                          fieldName="operadorAsociado"
                          placeholder="Elegir"
                        />
                        {watchOperadorAsociado && (
                          <EntityCard
                            disableLinks={true}
                            entity={
                              entities.find(
                                (obj) => obj.id === watchOperadorAsociado,
                              )!
                            }
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="sucursalOrigen"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Sucursal de origen</FormLabel>
                        <CustomSelector
                          data={entities
                            .filter((entity) => entity.tag.name === "Maika")
                            .map((entity) => ({
                              value: entity.id,
                              label: entity.name,
                            }))}
                          field={field}
                          fieldName="sucursalOrigen"
                          placeholder="Elegir"
                        />
                        {watchSucursalOrigen && (
                          <EntityCard
                            disableLinks={true}
                            entity={
                              entities.find(
                                (obj) => obj.id === watchSucursalOrigen,
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
            <DialogFooter>
              <DialogClose asChild>
                <Button type="submit">Editar</Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeEntityForm;
