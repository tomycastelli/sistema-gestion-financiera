"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { capitalizeFirstLetter, getAllChildrenTags } from "~/lib/functions";
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

const FormSchema = z.object({
  name: z.string(),
  tag: z.string(),
});

interface AddEntitiesFormProps {
  initialTags: RouterOutputs["tags"]["getAll"];
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
}

const AddEntitiesForm: FC<AddEntitiesFormProps> = ({
  initialTags,
  userPermissions,
}) => {
  const utils = api.useContext();

  const { mutateAsync } = api.entities.addOne.useMutation({
    async onMutate(newOperation) {
      toast({
        title: `Entidad ${newOperation.name} añadida`,
        variant: "success",
      });

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

      // Doing some ui actions
      toast({
        title:
          "No se pudo crear la entidad",
        description: `${JSON.stringify(err.message)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.entities.getAll.invalidate();
    },
  });

  const { data: tags } = api.tags.getAll.useQuery(undefined, {
    initialData: initialTags,
  });

  const filteredTags = tags.filter((tag) => {
    if (
      userPermissions?.find(
        (p) => p.name === "ADMIN" || p.name === "ACCOUNTS_VISUALIZE",
      )
    ) {
      return true;
    } else if (
      userPermissions?.find(
        (p) =>
          p.name === "ACCOUNTS_VISUALIZE_SOME" &&
          getAllChildrenTags(p.entitiesTags, tags).includes(tag.name),
      )
    ) {
      return true;
    }
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
                        {filteredTags.map((tag) => (
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
