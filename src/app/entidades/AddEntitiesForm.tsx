"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { capitalizeFirstLetter } from "~/lib/functions";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";

const FormSchema = z.object({
  name: z
    .string()
    .max(40, { message: "El nombre tiene que ser menor a 40 caracteres" }),
  tag: z.string().min(1),
});

interface AddEntitiesFormProps {
  tags: RouterOutputs["tags"]["getFiltered"];
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
}

const AddEntitiesForm: FC<AddEntitiesFormProps> = ({
  tags,
  userPermissions,
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const utils = api.useContext();

  const { mutateAsync } = api.entities.addOne.useMutation({
    async onMutate(newOperation) {
      // Doing the Optimistic update
      await utils.entities.getAll.cancel();

      const prevData = utils.entities.getAll.getData();

      utils.entities.getAll.setData(undefined, (old) => [
        // @ts-ignore
        ...old,
        {
          id: 0,
          name: newOperation.name,
          tag: {
            name: newOperation.tag,
          },
        },
      ]);

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.entities.getAll.setData(undefined, ctx?.prevData);

      toast.error(`No se pudo crear la entidad ${newOperation.name}`, {
        description: err.message,
      });
    },
    onSettled() {
      void utils.entities.getAll.invalidate();
    },
    onSuccess(data) {
      setOpen(false);
      reset({ name: "", tag: "" });
      toast.success(`Entidad ${data.name} añadida`);
    },
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const { handleSubmit, control, reset } = form;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    await mutateAsync({ name: data.name, tag: data.tag });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex flex-row space-x-2"
          disabled={
            userPermissions?.find(
              (p) =>
                p.name === "ADMIN" ||
                p.name === "ENTITIES_MANAGE" ||
                p.name === "ENTITIES_MANAGE_SOME",
            )
              ? false
              : true
          }
        >
          <p>Añadir entidad</p>
          <Icons.person className="h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Añadir entidad</DialogTitle>
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
              <FormField
                control={control}
                name="tag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Elegir" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tags
                          .filter((tag) => tag.name !== "Operadores")
                          .map((tag) => (
                            <SelectItem key={tag.name} value={tag.name}>
                              {capitalizeFirstLetter(tag.name)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cerrar
                </Button>
              </DialogClose>
              <Button type="submit">Añadir</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEntitiesForm;
