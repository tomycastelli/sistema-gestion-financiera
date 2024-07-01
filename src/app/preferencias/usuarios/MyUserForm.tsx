"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "~/trpc/react";
import { Button } from "~/app/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/app/components/ui/form";
import { Input } from "~/app/components/ui/input";
import { type User } from "lucia";
import { toast } from "sonner";

interface MyUserFormProps {
  user: User;
}

const MyUserForm: FC<MyUserFormProps> = ({ user }) => {
  const FormSchema = z.object({ name: z.string().max(25) });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: user.name,
    },
  });

  const { handleSubmit, control } = form;

  const utils = api.useContext();

  const { mutateAsync } = api.users.changeName.useMutation({
    async onMutate(newOperation) {
      await utils.users.getById.cancel();

      const prevData = utils.users.getById.getData();

      utils.users.getById.setData({ id: user.id }, (old) => ({
        ...old!,
        name: newOperation.name,
      }));

      return { prevData };
    },
    onError(err) {
      toast.error("No se pudo cambiar el nombre de usuario", {
        description: err.message,
      });
    },
    onSettled() {
      void utils.users.getById.invalidate();
    },
    onSuccess(data, variables) {
      toast.success(
        `Nombre modificado de ${variables.oldName} a ${variables.name}`,
      );
    },
  });

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    await mutateAsync({
      oldName: user.name,
      name: values.name,
      userId: user.id,
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
                <Input className="w-32" placeholder={user.name} {...field} />
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
