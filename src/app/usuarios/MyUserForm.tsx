"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { Button } from "../components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { toast } from "../components/ui/use-toast";

interface MyUserFormProps {
  initialUser: RouterOutputs["users"]["getById"];
}

const MyUserForm: FC<MyUserFormProps> = ({ initialUser }) => {
  const FormSchema = z.object({ name: z.string().max(25) });

  const { data: user } = api.users.getById.useQuery(
    { id: initialUser?.id ?? "" },
    { initialData: initialUser },
  );

  const name = user?.name;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: name ?? "",
    },
  });

  const { handleSubmit, control } = form;

  const utils = api.useContext();

  const { mutateAsync } = api.users.changeName.useMutation({
    async onMutate(newOperation) {
      toast({
        title: "Nombre de usuario modificado",
        description: `De ${newOperation.oldName} a ${newOperation.name}`,
        variant: "success",
      });

      await utils.users.getById.cancel();

      const prevData = utils.users.getById.getData();

      utils.users.getById.setData({ id: initialUser?.id ?? "" }, (old) => ({
        ...old!,
        name: newOperation.name,
      }));

      return { prevData };
    },
    onError(err) {
      toast({
        title: "No se pudo cambiar el nombre de usuario",
        description: `${JSON.stringify(err.data)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.users.getById.invalidate();
    },
  });

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    await mutateAsync({
      oldName: name ?? "",
      name: values.name,
      userId: initialUser?.id ?? "",
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de usuario</FormLabel>
              <FormControl>
                <Input className="w-32" placeholder={name ?? ""} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button variant="outline">Guardar</Button>
      </form>
    </Form>
  );
};

export default MyUserForm;
