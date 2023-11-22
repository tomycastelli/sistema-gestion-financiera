"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Icons } from "~/app/components/ui/Icons";
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
import { useToast } from "~/app/components/ui/use-toast";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

const FormSchema = z.object({
  email: z.string().email({ message: "El mail ingresado no es válido" }),
});

interface WhitelistProps {
  initialEmails: RouterOutputs["users"]["getWhitelist"];
}

const Whitelist: FC<WhitelistProps> = ({ initialEmails }) => {
  const { toast } = useToast();
  const utils = api.useContext();

  const { data: emails } = api.users.getWhitelist.useQuery(undefined, {
    initialData: initialEmails,
  });

  const { mutateAsync: deleteAsync } =
    api.users.removeFromWhiteList.useMutation({
      async onMutate(newOperation) {
        toast({
          title: "Whitelist actualizada",
          variant: "success",
        });

        await utils.users.getWhitelist.cancel();

        const prevData = utils.users.getWhitelist.getData();

        utils.users.getWhitelist.setData(
          undefined,
          (old) => old?.filter((email) => email.email !== newOperation.email),
        );

        return { prevData };
      },
      onError(err, newOperation, ctx) {
        utils.users.getWhitelist.setData(undefined, ctx?.prevData);

        // Doing some ui actions
        toast({
          title: "No se pudieron actualizar los permisos del usuario",
          description: `${JSON.stringify(err.data)}`,
          variant: "destructive",
        });
      },
      onSettled() {
        void utils.users.getWhitelist.invalidate();
      },
    });

  const { mutateAsync } = api.users.addToWhitelist.useMutation({
    async onMutate(newOperation) {
      toast({
        title: "Whitelist actualizada",
        variant: "success",
      });

      await utils.users.getWhitelist.cancel();

      const prevData = utils.users.getWhitelist.getData();

      utils.users.getWhitelist.setData(undefined, (old) => [
        // @ts-ignore
        ...old,
        newOperation.email,
      ]);

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.users.getWhitelist.setData(undefined, ctx?.prevData);

      // Doing some ui actions
      toast({
        title: "No se pudieron actualizar los permisos del usuario",
        description: `${JSON.stringify(err.data)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.users.getWhitelist.invalidate();
    },
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const { handleSubmit, control } = form;

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    await mutateAsync({ email: values.email });
  };

  return (
    <>
      {emails ? (
        <div className="grid grid-cols-1 gap-4">
          {emails.map((email, index) => (
            <div
              key={index}
              className="flex flex-row items-center justify-center space-x-4 rounded-xl border border-muted p-2"
            >
              <h1 className="text-xl font-semibold">{email.email}</h1>
              <Button
                onClick={async () => deleteAsync({ email: email.email })}
                variant="outline"
                className="bg-transparent p-1 hover:bg-transparent"
              >
                <Icons.cross className="h-6 text-red" />
              </Button>
            </div>
          ))}
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-row items-end justify-center space-x-2 rounded-xl border border-muted p-2"
            >
              <FormField
                control={control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="abcd@gmail.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                variant="outline"
                className="flex bg-transparent p-1 hover:bg-transparent"
              >
                <Icons.plus className="h-8 text-green" />
              </Button>
            </form>
          </Form>
        </div>
      ) : (
        <></>
      )}
    </>
  );
};

export default Whitelist;
