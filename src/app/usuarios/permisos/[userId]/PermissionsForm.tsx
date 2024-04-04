"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { type FC } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { capitalizeFirstLetter } from "~/lib/functions";
import { PermissionsNames, permissionsData } from "~/lib/permissionsTypes";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

const FormSchema = z.object({
  permissions: z.array(
    z.object({
      name: z.enum(PermissionsNames),
      active: z.boolean(),
      entitiesIds: z.set(z.number()),
      entitiesTags: z.set(z.string()),
    }),
  ),
});

interface PermissionsFormProps {
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  initialPermissions: RouterOutputs["users"]["getUserPermissions"];
  initialEntities: RouterOutputs["entities"]["getAll"];
  initialRoles: RouterOutputs["roles"]["getAll"];
  userId: string;
  tags: RouterOutputs["tags"]["getAll"];
}

const PermissionsForm: FC<PermissionsFormProps> = ({
  userPermissions,
  initialPermissions,
  initialEntities,
  initialRoles,
  userId,
  tags,
}) => {
  const utils = api.useContext();

  const { data: permissions } = api.users.getUserPermissions.useQuery(
    { id: userId },
    { initialData: initialPermissions, refetchOnWindowFocus: false },
  );

  const { data: roles } = api.roles.getAll.useQuery(undefined, {
    initialData: initialRoles,
    refetchOnWindowFocus: false,
  });

  const { data: entities } = api.entities.getAll.useQuery(undefined, {
    initialData: initialEntities,
    refetchOnWindowFocus: false,
  });

  const { data: user } = api.users.getById.useQuery(
    { id: userId },
    { refetchOnReconnect: false },
  );

  const { mutateAsync } = api.users.updatePermissions.useMutation({
    async onMutate(newOperation) {
      await utils.users.getUserPermissions.cancel();

      const prevData = utils.users.getUserPermissions.getData();

      utils.users.getUserPermissions.setData({ id: userId }, () => [
        ...newOperation.permissions,
      ]);

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.users.getUserPermissions.setData({ id: userId }, ctx?.prevData);

      toast.error("No se pudieron añadir los permisos", {
        description: err.message
      })
    },
    onSettled() {
      void utils.users.getUserPermissions.invalidate();
    },
    onSuccess() {
      toast.success("Permisos actualizados")
    }
  });

  let permissionsNames: string[] = [];
  if (permissions) {
    permissionsNames = permissions.map((obj) => obj.name);
  }

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      permissions: permissionsData.map((permission) => {
        if (permissionsNames.includes(permission.name)) {
          return {
            name: permission.name,
            active: true,
            entitiesIds: permissions
              ? permissions.find((item) => item.name === permission.name)
                ?.entitiesIds
                ? new Set(permissions.find((item) => item.name === permission.name)
                  ?.entitiesIds)
                : new Set<number>()
              : new Set<number>(),
            entitiesTags: permissions
              ? permissions.find((item) => item.name === permission.name)
                ?.entitiesTags
                ? new Set(permissions.find((item) => item.name === permission.name)
                  ?.entitiesTags)
                : new Set<string>()
              : new Set<string>(),
          };
        } else {
          return {
            name: permission.name,
            active: false,
            entitiesIds: new Set<number>(),
            entitiesTags: new Set<string>(),
          };
        }
      }),
    },
  });

  const { handleSubmit, control, setValue } = form;

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
            Permisos de <span className="font-semibold">{user?.name}</span>
          </h1>
          <Button type="submit">Guardar</Button>
        </div>
        {fields.map((loopField, index) => (
          <div
            key={loopField.id}
            className="flex flex-col space-y-0.5 rounded-xl border border-muted-foreground p-4"
          >
            <h1 className="text-lg font-semibold">
              {
                permissionsData.find(
                  (permission) => permission.name === loopField.name,
                )?.label
              }
            </h1>
            <p>
              {
                permissionsData.find(
                  (permission) => permission.name === loopField.name,
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
                      disabled={
                        userPermissions?.find(
                          (p) =>
                            p.name === "ADMIN" ||
                            (p.name === "USERS_PERMISSIONS_MANAGE" &&
                              loopField.name !== "ADMIN"),
                        )
                          ? false
                          : userPermissions?.find(
                            (p) =>
                              (p.name ===
                                "USERS_PERMISSIONS_MANAGE_ACCOUNTS" &&
                                loopField.name.startsWith("ACCOUNTS")) ||
                              (p.name ===
                                "USERS_PERMISSIONS_MANAGE_OPERATIONS" &&
                                loopField.name.startsWith("OPERATIONS")) ||
                              (p.name ===
                                "USERS_PERMISSIONS_MANAGE_TRANSACTIONS" &&
                                loopField.name.startsWith("TRANSACTIONS")) ||
                              (p.name === "USERS_PERMISSIONS_MANAGE_SOME" &&
                                user?.role?.name &&
                                p.entitiesTags?.has(user.role.name)) ||
                              (p.name ===
                                "USERS_PERMISSIONS_MANAGE_ENTITIES" &&
                                loopField.name.startsWith("ENTITIES")),
                          )
                            ? false
                            : true
                      }
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-readonly
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {loopField.name.endsWith("_SOME") && (
              <div className="flex flex-row space-x-4">
                {!loopField.name.startsWith("USERS_") && (
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
                                  ? Array.from(field.value).map((number) => (
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
                              <CommandEmpty>...</CommandEmpty>
                              <CommandGroup>
                                {entities.map((entity) => (
                                  <CommandItem
                                    value={entity.name}
                                    key={entity.id}
                                    onSelect={() => {
                                      if (!field.value.has(entity.id)) {
                                        setValue(
                                          `permissions.${index}.entitiesIds`,
                                          field.value.add(entity.id),
                                        );
                                      } else {
                                        field.value.delete(entity.id)
                                        setValue(
                                          `permissions.${index}.entitiesIds`,
                                          field.value
                                        );
                                      }
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value.has(entity.id)
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
                <FormField
                  control={control}
                  name={`permissions.${index}.entitiesTags`}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        {loopField.name.startsWith("USERS_") ? "Roles" : "Tags"}
                      </FormLabel>
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
                                ? Array.from(field.value).map((tag) => (
                                  <p key={tag}>
                                    {capitalizeFirstLetter(tag)}
                                  </p>
                                ))
                                : loopField.name.startsWith("USERS_")
                                  ? "Añadir rol"
                                  : "Añadir Tag"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                            <CommandInput
                              placeholder={
                                loopField.name.startsWith("USERS_")
                                  ? "Buscar rol..."
                                  : "Buscar entidad..."
                              }
                            />
                            <CommandEmpty>...</CommandEmpty>
                            <CommandGroup>
                              {loopField.name.startsWith("USERS_")
                                ? roles &&
                                roles.map((role) => (
                                  <CommandItem
                                    key={role.id}
                                    value={role.name}
                                    onSelect={() => {
                                      if (!field.value.has(role.name)) {
                                        setValue(
                                          `permissions.${index}.entitiesTags`,
                                          field.value.add(role.name)
                                        );
                                      } else {
                                        field.value.delete(role.name)
                                        setValue(
                                          `permissions.${index}.entitiesTags`,
                                          field.value
                                        );
                                      }
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value.has(role.name)
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    {capitalizeFirstLetter(role.name)}
                                  </CommandItem>
                                ))
                                : tags.map((tag) => (
                                  <CommandItem
                                    value={tag.name}
                                    key={tag.name}
                                    onSelect={() => {
                                      if (!field.value.has(tag.name)) {
                                        setValue(
                                          `permissions.${index}.entitiesTags`,
                                          field.value.add(tag.name),
                                        );
                                      } else {
                                        field.value.delete(tag.name)
                                        setValue(
                                          `permissions.${index}.entitiesTags`,
                                          field.value
                                        );
                                      }
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value.has(tag.name)
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    {capitalizeFirstLetter(tag.name)}
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
              </div>
            )}
          </div>
        ))}
      </form>
    </Form>
  );
};

export default PermissionsForm;
