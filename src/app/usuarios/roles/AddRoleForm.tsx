"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { type FC } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Icons } from "~/app/components/ui/Icons";
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
import { Input } from "~/app/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/components/ui/select";
import { Switch } from "~/app/components/ui/switch";
import { toast } from "~/app/components/ui/use-toast";
import { capitalizeFirstLetter } from "~/lib/functions";
import { PermissionsNames, permissionsData } from "~/lib/permissionsTypes";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

const FormSchema = z.object({
  name: z.string(),
  color: z.string(),
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
  initialEntities: RouterOutputs["entities"]["getAll"];
  initialTags: RouterOutputs["tags"]["getAll"];
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  roles: RouterOutputs["roles"]["getAll"];
  user: RouterOutputs["users"]["getById"];
}

const PermissionsForm: FC<PermissionsFormProps> = ({
  initialEntities,
  initialTags,
  userPermissions,
  user,
  roles,
}) => {
  const utils = api.useContext();

  const { data: entities } = api.entities.getAll.useQuery(undefined, {
    initialData: initialEntities,
    refetchOnWindowFocus: false,
  });

  const { mutateAsync } = api.roles.addOne.useMutation({
    async onMutate(newOperation) {
      toast({
        title: "Rol añadido",
        variant: "success",
      });

      await utils.roles.getAll.cancel();

      const prevData = utils.roles.getAll.getData();

      utils.roles.getAll.setData(undefined, (old) => [
        // @ts-ignore
        ...old,
        {
          id: old?.findLast((obj) => obj.id)?.id,
          name: newOperation.name,
          color: newOperation.color,
          permissions: newOperation.permissions,
        },
      ]);

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.roles.getAll.setData(undefined, ctx?.prevData);

      // Doing some ui actions
      toast({
        title: "No se pudo añadir el rol",
        description: `${JSON.stringify(err.message)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.roles.getAll.invalidate();
    },
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      color: "primary",
      permissions: permissionsData.map((permission) => {
        return {
          name: permission.name,
          active: false,
          entitiesIds: [],
          entitiesTags: [],
        };
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
    await mutateAsync({
      name: values.name,
      color: values.color,
      permissions: addedPermissions,
    });
  };

  const colors = [
    {
      label: "Rojo",
      value: "red",
    },
    {
      label: "Verde",
      value: "green",
    },
    {
      label: "Naranja",
      value: "orange",
    },
    {
      label: "Azul",
      value: "primary",
    },
    {
      label: "Amarillo",
      value: "amber-400",
    },
    {
      label: "Violeta",
      value: "violet-500",
    },
    {
      label: "Rosa",
      value: "pink-500",
    },
    {
      label: "Celeste",
      value: "blue-400",
    },
  ];

  const { data: tags } = api.tags.getAll.useQuery(undefined, {
    initialData: initialTags,
    refetchOnWindowFocus: false,
  });

  return (
    <Form {...form}>
      <form
        className="flex flex-col space-y-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex flex-row justify-between">
          <div className="flex flex-row space-x-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
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
                      {colors.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex flex-row items-center space-x-2">
                            <span
                              className={cn(
                                "rounded-full p-[9px]",
                                color.value === "red"
                                  ? "bg-red"
                                  : color.value === "amber-400"
                                    ? "bg-amber-400"
                                    : color.value === "green"
                                      ? "bg-green"
                                      : color.value === "primary"
                                        ? "bg-primary"
                                        : color.value === "violet-500"
                                          ? "bg-violet-500"
                                          : color.value === "orange"
                                            ? "bg-orange"
                                            : color.value === "pink-500"
                                              ? "bg-pink-500"
                                              : color.value === "blue-400"
                                                ? "bg-blue-400"
                                                : "bg-gray-400",
                              )}
                            ></span>
                            <p>{color.label}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button variant="outline" type="submit">
            <p>Añadir rol</p>
            <Icons.plus className="ml-2 h-7 text-green" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4">
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
                                  loopField.name.startsWith(
                                    "TRANSACTIONS",
                                  )) ||
                                (p.name === "USERS_PERMISSIONS_MANAGE_SOME" &&
                                  user?.role?.name &&
                                  p.entitiesTags?.includes(user.role.name)) ||
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
                                <CommandEmpty>...</CommandEmpty>
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
                  <FormField
                    control={control}
                    name={`permissions.${index}.entitiesTags`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>
                          {loopField.name.startsWith("USERS_")
                            ? "Roles"
                            : "Tags"}
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
                                  ? field.value.map((tag) => (
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
                                        if (
                                          !field.value.includes(role.name)
                                        ) {
                                          setValue(
                                            `permissions.${index}.entitiesTags`,
                                            [...field.value, role.name],
                                          );
                                        } else {
                                          setValue(
                                            `permissions.${index}.entitiesTags`,
                                            field.value.filter(
                                              (number) =>
                                                number !== role.name,
                                            ),
                                          );
                                        }
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value.includes(role.name)
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
                                        if (!field.value.includes(tag.name)) {
                                          setValue(
                                            `permissions.${index}.entitiesTags`,
                                            [...field.value, tag.name],
                                          );
                                        } else {
                                          setValue(
                                            `permissions.${index}.entitiesTags`,
                                            field.value.filter(
                                              (number) => number !== tag.name,
                                            ),
                                          );
                                        }
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value.includes(tag.name)
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
        </div>
      </form>
    </Form>
  );
};

export default PermissionsForm;
