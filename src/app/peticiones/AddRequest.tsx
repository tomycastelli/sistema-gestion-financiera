"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type Session } from "next-auth";
import { useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "~/trpc/react";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
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

interface AddRequestProps {
  session: Session;
}

const AddRequest: FC<AddRequestProps> = ({ session }) => {
  const [isOpen, setIsOpen] = useState(false);
  const utils = api.useContext();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: "",
      content: "",
    },
  });

  const { handleSubmit, control } = form;

  const { mutateAsync: addAsync } = api.requests.addOne.useMutation({
    async onMutate(newOperation) {
      toast({
        title: "Petición añadida",
        variant: "success",
      });

      setIsOpen(false);

      await utils.requests.getAll.cancel();

      const prevData = utils.requests.getAll.getData(undefined);

      utils.requests.getAll.setData(undefined, (old) =>
        old
          ? [
              ...old,
              {
                id: 0,
                uploadedBy: session.user.id,
                uploadedByUser: { name: session.user.name! },
                title: newOperation.title,
                content: newOperation.content,
                status: "pending",
                developerMessage: "",
              },
            ]
          : [],
      );

      return { prevData };
    },
    onError(err) {
      const prevData = utils.requests.getAll.getData(undefined);
      // Doing some ui actions
      toast({
        title: "No se pudo añadir la petición",
        description: `${JSON.stringify(err.data)}`,
        variant: "destructive",
      });
      return { prevData };
    },
    onSettled() {
      void utils.requests.getAll.invalidate();
    },
  });

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    void addAsync({
      title: values.title,
      content: values.content,
    });
  };

  return (
    <Dialog open={isOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Icons.addPackage className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Nueva petición</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cerrar
            </Button>
            <Button type="submit">Añadir petición</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddRequest;
