"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/app/components/ui/alert-dialog";
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
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "../components/ui/use-toast";

interface AddTagsFormProps {
  initialTags: RouterOutputs["tags"]["getAll"];
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  entities: RouterOutputs["entities"]["getAll"];
}

const AddTagsForm: FC<AddTagsFormProps> = ({
  initialTags,
  userPermissions,
  entities,
}) => {
  const { data: tags } = api.tags.getAll.useQuery(undefined, {
    initialData: initialTags,
    refetchOnWindowFocus: false,
  });

  const manageableTags = tags.filter((tag) => {
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

  const FormSchema = z
    .object({
      name: z.string(),
      parent: z.string().optional(),
    })
    .refine(
      (data) => {
        const condition =
          manageableTags && initialTags.length > manageableTags.length;
        if (condition) {
          return data.parent !== undefined;
        }
        return true;
      },
      {
        message: "El tag padre es obligatorio",
      },
    );

  const utils = api.useContext();

  const { mutateAsync: removeTag } = api.tags.removeOne.useMutation({
    async onMutate(newOperation) {
      toast({
        title: `Tag ${newOperation.name} eliminado`,
        variant: "success",
      });

      // Doing the Optimistic update
      await utils.tags.getAll.cancel();

      const prevData = utils.tags.getAll.getData();

      utils.tags.getAll.setData(
        undefined,
        (old) => old?.filter((tag) => tag.name !== newOperation.name),
      );

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.tags.getAll.setData(undefined, ctx?.prevData);

      // Doing some ui actions
      toast({
        title: "No se pudo eliminar el tag",
        description: `${JSON.stringify(err.message)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.tags.getAll.invalidate();
    },
  });

  const { mutateAsync } = api.tags.addOne.useMutation({
    async onMutate(newOperation) {
      toast({
        title: `Tag ${newOperation.name} añadido`,
        variant: "success",
      });

      // Doing the Optimistic update
      await utils.tags.getAll.cancel();

      const prevData = utils.tags.getAll.getData();

      utils.tags.getAll.setData(undefined, (old) => [
        // @ts-ignore
        ...old,
        newOperation,
      ]);

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.tags.getAll.setData(undefined, ctx?.prevData);

      // Doing some ui actions
      toast({
        title: "No se pudo añadir el tag",
        description: `${JSON.stringify(err.message)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.tags.getAll.invalidate();
    },
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const { handleSubmit, control } = form;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    await mutateAsync({ name: data.name, parent: data.parent });
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
          <p>Añadir tag</p>
          <Icons.tag className="h-4 text-black" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle>Añadir tag</DialogTitle>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cerrar
                </Button>
              </DialogClose>
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
                name="parent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Padre</FormLabel>
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
                        {manageableTags &&
                          manageableTags
                            .filter((tag) => tag.name !== "usuario")
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
              <Button type="submit" variant="outline">
                Añadir
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <ScrollArea className="h-80 w-full">
          <div className="grid grid-cols-1 gap-2 pr-6">
            {tags.map((tag, index) => (
              <div
                key={index}
                className="flex flex-row items-center justify-between rounded-xl border border-muted p-2"
              >
                <div className="flex flex-row space-x-4">
                  <h1>{capitalizeFirstLetter(tag.name)}</h1>
                  {tag.parent && (
                    <p className="text-muted-foreground">
                      {capitalizeFirstLetter(tag.parent)}
                    </p>
                  )}
                </div>

                {tag.name !== "usuario" &&
                  !entities.find((entity) =>
                    getAllChildrenTags(tag.name, tags).includes(
                      entity.tag.name,
                    ),
                  ) &&
                  manageableTags.find((item) => item.name === tag.name) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="border-transparent p-1"
                        >
                          <Icons.cross className="h-4 text-red" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            ¿Seguro que querés borrar el tag?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esto es posible ya que no hay entidades relacionadas
                            con este tag
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red"
                            onClick={() => removeTag({ name: tag.name })}
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AddTagsForm;
