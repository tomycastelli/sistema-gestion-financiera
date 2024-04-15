"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/app/components/ui/command";
import { createQueryString } from "~/lib/functions";
import { api } from "~/trpc/react";
import { Icons } from "./Icons";
import { Button } from "./button";

const CommandMenu = () => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState<string>();

  const { data: tags, isSuccess: isTagsSuccess } =
    api.tags.getFiltered.useQuery(undefined, { enabled: open });
  const { data: entities, isSuccess: isEntitiesSuccess } =
    api.entities.getFiltered.useQuery(
      { permissionName: "ACCOUNTS_VISUALIZE" },
      { enabled: open },
    );
  const { data: userPermissions } = api.users.getAllPermissions.useQuery(
    undefined,
    { enabled: open },
  );

  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Check if Command + U is pressed
    if (e.metaKey) {
      // Prevent the default action (e.g., browser's save page)
      e.preventDefault();

      if (e.key === "u") {
        handleSelect("/usuarios");
      } else if (e.key === "p") {
        handleSelect("/usuarios/permisos");
      } else if (e.key === "r") {
        handleSelect("/usuarios/roles");
      } else if (e.key === "c") {
        handleSelect("/operaciones/carga");
      } else if (e.key === "g") {
        handleSelect("/operaciones/gestion");
      } else if (e.key === "j") {
        handleSelect("/logs");
      } else if (e.key === "e") {
        handleSelect("/entidades");
      }
    }
  };

  return (
    <>
      <div
        className="flex flex-row items-center space-x-2 rounded-xl border p-2 text-muted-foreground hover:cursor-pointer hover:bg-muted"
        onClick={() => setOpen(true)}
      >
        <p className="text-sm">Comandos</p>
        <kbd className="text-md pointer-events-none inline-flex h-7 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono font-light text-muted-foreground opacity-100">
          <span>⌘</span>K
        </kbd>
      </div>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        handleKeyDown={handleKeyDown}
      >
        <CommandInput
          placeholder="Buscar comando"
          onValueChange={(search) => setSearchValue(search)}
        />
        {searchValue?.startsWith("op:") && (
          <Link
            prefetch={false}
            href={{
              pathname: `/operaciones/gestion/${searchValue.split("op:")[1]}`,
            }}
          >
            <Button
              className="flex w-full flex-row justify-start space-x-2 border-transparent"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setSearchValue(undefined);
              }}
            >
              <Icons.addPackage className="h-5" />
              <p>
                {searchValue.split("op:")[1] &&
                  searchValue.split("op:")[1]!.length >= 1
                  ? searchValue.split("op:")[1]
                  : "Elegi un numero de operacion"}
              </p>
            </Button>
          </Link>
        )}
        <CommandList>
          <CommandEmpty>No se encontraron comandos.</CommandEmpty>
          <CommandGroup heading="Operaciones">
            {userPermissions?.find(
              (p) =>
                p.name === "ADMIN" || p.name.startsWith("OPERATIONS_CREATE"),
            ) && (
                <CommandItem
                  onSelect={() => handleSelect("/operaciones/carga")}
                  value="Cargar operaciones"
                >
                  <Icons.addPackage className="mr-2 h-4 w-4" />
                  <span>Cargar operaciones</span>
                  <CommandShortcut>⌘C</CommandShortcut>
                </CommandItem>
              )}
            {userPermissions?.find(
              (p) =>
                p.name === "ADMIN" || p.name.startsWith("OPERATIONS_VISUALIZE"),
            ) && (
                <>
                  <CommandItem
                    onSelect={() => handleSelect("/operaciones/gestion")}
                    value="Gestionar operaciones"
                  >
                    <Icons.editing className="mr-2 h-4 w-4" />
                    <span>Gestionar operaciones</span>
                    <CommandShortcut>⌘G</CommandShortcut>
                  </CommandItem>
                </>
              )}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Entidades">
            <CommandItem onSelect={() => handleSelect("/entidades")}>
              <Icons.entities className="mr-2 h-4 w-4" />
              <span>Gestionar entidades</span>
              <CommandShortcut>⌘E</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect("/entidades/grafico")}>
              <Icons.entitiesGraph className="mr-2 h-4 w-4" />
              <span>Gráfico</span>
              <CommandShortcut>⌘G</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Usuarios">
            <CommandItem
              onSelect={() => handleSelect("/usuarios")}
              value="Mi usuario"
            >
              <Icons.person className="mr-2 h-4 w-4" />
              <span>Mi usuario</span>
              <CommandShortcut>⌘U</CommandShortcut>
            </CommandItem>
            {userPermissions?.find(
              (p) =>
                p.name === "ADMIN" || p.name.startsWith("USERS_PERMISSIONS"),
            ) && (
                <CommandItem
                  onSelect={() => handleSelect("/usuarios/permisos")}
                  value="Permisos"
                >
                  <Icons.settings className="mr-2 h-4 w-4" />
                  <span>Permisos</span>
                  <CommandShortcut>⌘P</CommandShortcut>
                </CommandItem>
              )}
            {userPermissions?.find(
              (p) => p.name === "ADMIN" || p.name.startsWith("USERS_ROLES"),
            ) && (
                <CommandItem
                  onSelect={() => handleSelect("/usuarios/roles")}
                  value="Roles"
                >
                  <Icons.roles className="mr-2 h-4 w-4" />
                  <span>Roles</span>
                  <CommandShortcut>⌘R</CommandShortcut>
                </CommandItem>
              )}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Logs">
            <CommandItem
              key="logs"
              value="logs"
              onSelect={() => handleSelect("/logs")}
            >
              <Icons.documentPlus className="mr-2 h-4 w-4" />
              <span>Logs</span>
              <CommandShortcut>⌘J</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Cuentas">
            <p className="ml-2 mt-1 text-xs text-muted-foreground">Tags</p>
            {isTagsSuccess &&
              tags.map((tag) => (
                <CommandItem
                  key={tag.name}
                  value={tag.name}
                  onSelect={() =>
                    handleSelect(
                      "/cuentas" +
                      "?" +
                      createQueryString(undefined, "tag", tag.name),
                    )
                  }
                >
                  <Icons.tagCurrentAccounts className="mr-2 h-4 w-4" />
                  <span>{tag.name}</span>
                </CommandItem>
              ))}
            <p className="ml-2 mt-1 text-xs text-muted-foreground">Entidades</p>
            {isEntitiesSuccess &&
              entities.map((entity) => (
                <CommandItem
                  key={entity.id}
                  value={entity.name}
                  onSelect={() =>
                    handleSelect(
                      "/cuentas" +
                      "?" +
                      createQueryString(
                        undefined,
                        "entidad",
                        entity.id.toString(),
                      ),
                    )
                  }
                >
                  <Icons.currentAccount className="mr-2 h-4 w-4" />
                  <span>{entity.name}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default CommandMenu;
