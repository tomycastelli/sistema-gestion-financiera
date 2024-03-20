"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type FC } from "react";
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
import { Textarea } from "../components/ui/textarea";
import { toast } from "../components/ui/use-toast";

const FormSchema = z.object({
  title: z.string(),
  content: z.string(),
});

interface UpdateRequestProps {
  request: RouterOutputs["requests"]["getAll"][number];
}

const UpdateRequest: FC<UpdateRequestProps> = ({ request }) => {
  const [isOpen, setIsOpen] = useState(false);
  const utils = api.useContext();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: request.title,
      content: request.content,
    },
  });

  const { handleSubmit, control, reset } = form;

  const { mutateAsync: updateAsync } = api.requests.updateOne.useMutation({
    async onMutate(newOperation) {
      toast({
        title: `Petición ${newOperation.id} guardada`,
        variant: "success",
      });

      setIsOpen(false);

      reset({
        title: newOperation.title,
        content: newOperation.content,
      });

      await utils.requests.getAll.cancel();

      const prevData = utils.requests.getAll.getData(undefined);

      utils.requests.getAll.setData(undefined, (old) =>
        old
          ? [
            ...old.map((r) => {
              if (r.id === newOperation.id) {
                return {
                  ...r,
                  id: r.id,
                  title: newOperation.title,
                  content: newOperation.content,
                };
              } else {
                return r;
              }
            }),
          ]
          : [],
      );

      return { prevData };
    },
    onError(err) {
      const prevData = utils.requests.getAll.getData(undefined);
      // Doing some ui actions
      toast({
        title: "No se pudo actualizar la petición",
        description: `${JSON.stringify(err.message)}`,
        variant: "destructive",
      });
      return { prevData };
    },
    onSettled() {
      void utils.requests.getAll.invalidate();
    },
  });

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    void updateAsync({
      id: request.id,
      title: values.title,
      content: values.content,
    });
  };

  return (
    <Dialog open={isOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Icons.editing className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <DialogHeader>
              <DialogTitle>
                Petición <span>{request.id}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 items-center gap-4">
              <FormField
                control={control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 items-center gap-4">
              <FormField
                control={control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contenido</FormLabel>
                    <FormControl>
                      <Textarea className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cerrar
                </Button>
              </DialogClose>
              <Button type="submit">Guardar cambios</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateRequest;
