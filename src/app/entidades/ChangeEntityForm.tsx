"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

interface ChangeEntityFormProps {
  entity: RouterOutputs["entities"]["getAll"][number];
  tags: RouterOutputs["tags"]["getFiltered"]
}

const FormSchema = z.object({
  name: z.string(),
  tag: z.string(),
});

const ChangeEntityForm = ({ entity, tags }: ChangeEntityFormProps) => {
  const utils = api.useContext();

  const { mutateAsync } = api.entities.updateOne.useMutation({
    async onMutate(newOperation) {
      // Doing the Optimistic update
      await utils.entities.getAll.cancel();

      const prevData = utils.entities.getAll.getData();

      utils.entities.getAll.setData(undefined, (old) => [
        // @ts-ignore
        ...old?.map((item) => {
          if (item.id === entity.id) {
            return {
              ...item,
              name: newOperation.name,
              tag: newOperation.tag ? newOperation.tag : entity.tag,
            };
          }
          return item;
        }),
      ]);

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.entities.getAll.setData(undefined, ctx?.prevData);

      toast.error(`No se pudo cargar la entidad ${newOperation.id}`, {
        description: err.message
      })
    },
    onSettled() {
      void utils.entities.getAll.invalidate();
    },
    onSuccess(data) {
      toast.success(`Entidad ${data.id} modificada`)
    },
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: entity.name,
      tag: entity.tag.name,
    },
  });

  const { handleSubmit, control } = form;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    await mutateAsync({ id: entity.id, name: data.name, tag: data.tag });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-transparent p-1">
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
              {entity.tag.name !== "user" && (
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
                          {tags.map(tag => (
                            <SelectItem value={tag.name} key={tag.name}>{tag.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
