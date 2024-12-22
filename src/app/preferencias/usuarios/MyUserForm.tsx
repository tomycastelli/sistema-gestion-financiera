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
import CustomSelector from "~/app/components/forms/CustomSelector";
import { RouterOutputs } from "~/trpc/shared";
import EntityCard from "~/app/components/ui/EntityCard";

interface MyUserFormProps {
  user: User;
  entities: RouterOutputs["entities"]["getAll"];
}

const MyUserForm: FC<MyUserFormProps> = ({ user, entities }) => {
  const FormSchema = z.object({
    name: z.string().max(25),
    preferredEntityId: z.string().nullable().optional(),
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: user.name,
      preferredEntityId: user.preferredEntity?.toString(),
    },
  });

  const { handleSubmit, control, watch } = form;

  const utils = api.useContext();

  const watchPreferredEntity = watch("preferredEntityId");

  const { mutateAsync } = api.users.changeUser.useMutation({
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
    onSuccess() {
      toast.success(`Preferencias actualizadas`);
    },
  });

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    await mutateAsync({
      oldName: user.name,
      name: values.name,
      userId: user.id,
      preferredEntityId: values.preferredEntityId
        ? parseInt(values.preferredEntityId)
        : null,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="gap-y-2">
        <div className="mb-4 flex flex-row justify-start gap-x-4">
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
          <FormField
            control={control}
            name="preferredEntityId"
            defaultValue={user.preferredEntity?.toString()}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Entidad preferida</FormLabel>
                <CustomSelector
                  data={entities
                    .filter((entity) => entity.tag.name === "Maika")
                    .map((entity) => ({
                      value: entity.id.toString(),
                      label: entity.name,
                    }))}
                  field={field}
                  fieldName="preferredEntityId"
                  placeholder="Elegir"
                />
                {watchPreferredEntity && (
                  <EntityCard
                    disableLinks={true}
                    entity={
                      entities.find(
                        (obj) => obj.id.toString() === watchPreferredEntity,
                      )!
                    }
                  />
                )}
              </FormItem>
            )}
          />
        </div>
        <Button variant="outline">Guardar</Button>
      </form>
    </Form>
  );
};

export default MyUserForm;
