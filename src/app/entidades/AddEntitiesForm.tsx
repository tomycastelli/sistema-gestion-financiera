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
import { toast } from "../components/ui/use-toast";

interface AddEntitiesFormProps {
  tags: string[];
  entities: RouterOutputs["entities"]["getAll"];
}

const FormSchema = z.object({
  name: z.string(),
  tag: z.string(),
});

const AddEntitiesForm = ({ tags, entities }: AddEntitiesFormProps) => {
  const utils = api.useContext();

  const { mutateAsync } = api.entities.addOne.useMutation({
    async onMutate(newOperation) {
      toast({
        title: "You submitted the following values:",
        description: (
          <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
            <code className="text-white">
              {JSON.stringify(newOperation, null, 2)}
            </code>
          </pre>
        ),
      });

      // Doing the Optimistic update
      await utils.entities.getAll.cancel();

      const prevData = utils.entities.getAll.getData();

      const fakeNewData: RouterOutputs["entities"]["getAll"][number] = {
        id: entities.length + 2,
        name: newOperation.name,
        tag: newOperation.tag,
      };

      utils.entities.getAll.setData(undefined, (old) => [
        fakeNewData,
        // @ts-ignore
        ...old,
      ]);

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.entities.getAll.setData(undefined, ctx?.prevData);

      // Doing some ui actions
      toast({
        title:
          "No se pudo cargar la operación y las transacciones relacionadas",
        description: `${JSON.stringify(err.data)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.entities.getAll.invalidate();
    },
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const { handleSubmit, control } = form;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    await mutateAsync({ name: data.name, tag: data.tag });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex flex-row space-x-2">
          <p>Añadir entidad</p>
          <Icons.person className="h-4 text-black" />
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
                        <SelectItem value="client">Cliente</SelectItem>
                        <SelectItem value="maika">Maika</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="submit">Añadir</Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEntitiesForm;
