"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { type Session } from "next-auth";
import { type FC } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/app/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "~/app/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/app/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/components/ui/popover";
import { Switch } from "~/app/components/ui/switch";
import { toast } from "~/app/components/ui/use-toast";
import { PermissionsNames, permissionsData } from "~/lib/permissionsTypes";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

const FormSchema = z.object({
  permissions: z.array(
    z.object({
      name: z.enum(PermissionsNames),
      active: z.boolean(),
      entitiesIds: z.array(z.number()),
      entitiesTags: z.array(z.string()),
    }),
  ),
});

interface PermissionsFormProps {
  initialPermissions: RouterOutputs["users"]["getUserPermissions"];
  initialEntities: RouterOutputs["entities"]["getAll"];
  userId: string;
  session: Session;
}

const PermissionsForm: FC<PermissionsFormProps> = ({
  initialPermissions,
  initialEntities,
  userId,
  session,
}) => {
  const utils = api.useContext();

  const { data: permissions } = api.users.getUserPermissions.useQuery(
    { id: userId },
    { initialData: initialPermissions, refetchOnWindowFocus: false },
  );

  const { data: entities } = api.entities.getAll.useQuery(undefined, {
    initialData: initialEntities,
    refetchOnWindowFocus: false,
  });

  const { mutateAsync } = api.users.updatePermissions.useMutation({
    async onMutate(newOperation) {
      toast({
        title: "Permisos actualizados",
        variant: "success",
      });

      await utils.users.getUserPermissions.cancel();

      const prevData = utils.users.getUserPermissions.getData();

      utils.users.getUserPermissions.setData({ id: userId }, () => [
        ...newOperation.permissions,
      ]);

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.users.getUserPermissions.setData({ id: userId }, ctx?.prevData);

      // Doing some ui actions
      toast({
        title: "No se pudieron actualizar los permisos del usuario",
        description: `${JSON.stringify(err.data)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.users.getUserPermissions.invalidate();
    },
  });

  const permissionsNames = permissions.map((obj) => obj.name);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      permissions: permissionsData.map((permission) => {
        if (permissionsNames.includes(permission.name)) {
          return {
            name: permission.name,
            active: true,
            entitiesIds: permissions.find(
              (item) => item.name === permission.name,
            )?.entitiesIds
              ? permissions.find((item) => item.name === permission.name)
                  ?.entitiesIds
              : [],
            entitiesTags: permissions.find(
              (item) => item.name === permission.name,
            )?.entitiesTags
              ? permissions.find((item) => item.name === permission.name)
                  ?.entitiesTags
              : [],
          };
        } else {
          return {
            name: permission.name,
            active: false,
            entitiesIds: [],
            entitiesTags: [],
          };
        }
      }),
    },
  });

  const { handleSubmit, control, watch, reset, setValue } = form;

  const { fields } = useFieldArray({
    control,
    name: "permissions",
  });

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    const addedPermissions = values.permissions.filter(
      (permission) => permission.active === true,
    );
    await mutateAsync({ id: userId, permissions: addedPermissions });
  };

  return (
    <Form {...form}>
      <form
        className="grid grid-cols-1 gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="mb-4 flex flex-row justify-between">
          <h1 className="text-2xl">
            Permisos de{" "}
            <span className="font-semibold">{session.user.name}</span>
          </h1>
          <Button type="submit">Guardar</Button>
        </div>
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col space-y-0.5 rounded-xl border border-muted-foreground p-4"
          >
            <h1 className="text-lg font-semibold">
              {
                permissionsData.find(
                  (permission) => permission.name === field.name,
                )?.label
              }
            </h1>
            <p>
              {
                permissionsData.find(
                  (permission) => permission.name === field.name,
                )?.description
              }
            </p>
            <FormField
              control={control}
              name={`permissions.${index}.active`}
              render={({ field }) => (
                <FormItem className="flex w-16 flex-row items-center justify-start space-x-2 rounded-lg">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-readonly
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {field.name.endsWith("_SOME") && (
              <FormField
                control={form.control}
                name={`permissions.${index}.entitiesIds`}
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Entidades</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-[200px] justify-start space-x-2",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value
                              ? field.value.map((number) => (
                                  <p key={number}>{number}</p>
                                ))
                              : "Añadir entidad"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar entidad..." />
                          <CommandEmpty>No language found.</CommandEmpty>
                          <CommandGroup>
                            {entities.map((entity) => (
                              <CommandItem
                                value={entity.name}
                                key={entity.id}
                                onSelect={() => {
                                  if (!field.value.includes(entity.id)) {
                                    setValue(
                                      `permissions.${index}.entitiesIds`,
                                      [...field.value, entity.id],
                                    );
                                  } else {
                                    setValue(
                                      `permissions.${index}.entitiesIds`,
                                      field.value.filter(
                                        (number) => number !== entity.id,
                                      ),
                                    );
                                  }
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value.includes(entity.id)
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {entity.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        ))}
      </form>
    </Form>
  );
};

export default PermissionsForm;
