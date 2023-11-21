"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type Session } from "next-auth";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "~/trpc/react";
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
  session: Session;
}

const MyUserForm: FC<MyUserFormProps> = ({ session }) => {
  const FormSchema = z.object({ name: z.string().max(25) });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: session.user.name ? session.user.name : "",
    },
  });

  const { handleSubmit, control, setValue } = form;

  const { mutateAsync } = api.users.changeName.useMutation({
    onMutate(newOperation) {
      toast({
        title: "Nombre de usuario modificado",
        description: `De ${newOperation.oldName} a ${newOperation.name}`,
        variant: "success",
      });

      setValue("name", newOperation.name);
    },
    onError(err) {
      toast({
        title: "No se pudo cambiar el nombre de usuario",
        description: `${JSON.stringify(err.data)}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    if (session.user.name) {
      await mutateAsync({
        oldName: session.user.name,
        name: values.name,
        userId: session.user.id,
      });
    }
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
                <Input
                  className="w-32"
                  placeholder={session.user.name ? session.user.name : ""}
                  {...field}
                />
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
