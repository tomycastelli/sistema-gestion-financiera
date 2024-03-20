"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Icons } from "~/app/components/ui/Icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/app/components/ui/alert-dialog";
import { Button } from "~/app/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/app/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/components/ui/select";
import { toast } from "~/app/components/ui/use-toast";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

interface ManageUsersProps {
  initialRole: RouterOutputs["roles"]["getById"];
  initialUsers: RouterOutputs["users"]["getAll"];
}

const FormSchema = z.object({
  userId: z.string(),
});

const ManageUsers: FC<ManageUsersProps> = ({ initialRole, initialUsers }) => {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const { data: role } = api.roles.getById.useQuery(
    { id: initialRole!.id },
    { initialData: initialRole!, refetchOnWindowFocus: false },
  );

  const utils = api.useContext();

  const { handleSubmit, control } = form;

  const { data: users } = api.users.getAll.useQuery(undefined, {
    initialData: initialUsers,
    refetchOnWindowFocus: false,
  });

  const { mutateAsync: addUserToRole } = api.users.addUserToRole.useMutation({
    async onMutate(newOperation) {
      toast({
        title: "Usuario añadido",
        variant: "success",
      });

      await utils.roles.getById.cancel();

      const prevData = utils.roles.getById.getData();

      utils.roles.getById.setData(
        { id: role!.id },
        // @ts-ignore
        (old) => {
          return {
            id: old!.id,
            name: old!.name,
            color: old!.color,
            permissions: old!.permissions,
            users: [
              ...old!.users,
              users.find((user) => user.id === newOperation.userId),
            ],
          };
        },
      );

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.roles.getById.setData({ id: role!.id }, ctx?.prevData);

      // Doing some ui actions
      toast({
        title: "No se pudo añadir el usuario",
        description: `${JSON.stringify(err.message)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.roles.getById.invalidate();
    },
  });
  const { mutateAsync: removeUserFromRole } =
    api.users.removeUserFromRole.useMutation({
      async onMutate(newOperation) {
        toast({
          title: "Usuario eliminado",
          variant: "success",
        });

        await utils.roles.getById.cancel();

        const prevData = utils.roles.getById.getData();

        utils.roles.getById.setData(
          { id: role!.id },
          // @ts-ignore
          (old) => {
            return {
              id: old!.id,
              name: old!.name,
              color: old!.color,
              permissions: old!.permissions,
              users: old!.users.filter((user) => user.id !== newOperation.id),
            };
          },
        );

        return { prevData };
      },
      onError(err, newOperation, ctx) {
        utils.roles.getById.setData({ id: role!.id }, ctx?.prevData);

        // Doing some ui actions
        toast({
          title: "No se pudo eliminar el usuario",
          description: `${JSON.stringify(err.message)}`,
          variant: "destructive",
        });
      },
      onSettled() {
        void utils.roles.getById.invalidate();
      },
    });

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    await addUserToRole({ userId: values.userId, roleId: role!.id });
  };

  const userNamesInRole = role!.users.map((user) => user.name);

  return (
    <div className="flex flex-col space-y-4">
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField
            control={control}
            name="userId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Usuario</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {users
                      .filter((user) => !userNamesInRole.includes(user.name))
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" variant="outline" className="mt-2">
            Añadir usuario
          </Button>
        </form>
      </Form>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {role!.users.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <CardTitle>
                  <Link
                    href={`/usuarios/permisos/${user.id}`}
                    key={user.id}
                    className="flex flex-col items-center justify-center rounded-xl transition-all hover:scale-105"
                  >
                    {user.name}
                  </Link>
                </CardTitle>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-transparent p-1"
                    >
                      <Icons.cross className="h-6 text-red" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Seguro que querés eliminar al usuario de este rol?
                      </AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red"
                        onClick={async () =>
                          await removeUserFromRole({ id: user.id })
                        }
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <CardDescription>{user.email}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ManageUsers;
