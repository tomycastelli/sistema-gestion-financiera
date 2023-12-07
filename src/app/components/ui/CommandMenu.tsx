"use client";

import { useEffect, useState, type FC } from "react";

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
import { type RouterOutputs } from "~/trpc/shared";
import { Icons } from "./Icons";

interface CommandMenuProps {
  tags: RouterOutputs["tags"]["getFiltered"];
  entities: RouterOutputs["entities"]["getFiltered"];
}

const CommandMenu: FC<CommandMenuProps> = ({ tags, entities }) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isMac =
    typeof window !== "undefined"
      ? navigator.userAgent.toUpperCase().indexOf("MAC") >= 0
      : false;

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
      } else if (e.key === "a") {
        handleSelect("/operaciones/gestion");
      } else if (e.key === "e") {
        handleSelect("/entidades");
      } else if (e.key === "g") {
        handleSelect("/entidades/grafico");
      }
    }
  };

  return (
    <>
      <div
        className="flex flex-row items-center space-x-2 text-muted-foreground hover:cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <p>Comandos</p>
        <kbd className="pointer-events-none inline-flex h-7 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xl font-light text-muted-foreground opacity-100">
          <span>{isMac ? "⌘" : "CTRL"}</span>K
        </kbd>
      </div>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        handleKeyDown={handleKeyDown}
      >
        <CommandInput placeholder="Buscar comando" />
        <CommandList>
          <CommandEmpty>No se encontraron comandos.</CommandEmpty>
          <CommandGroup heading="Operaciones">
            <CommandItem onSelect={() => handleSelect("/operaciones/carga")}>
              <Icons.addPackage className="mr-2 h-4 w-4" />
              <span>Carga</span>
              <CommandShortcut>⌘C</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect("/operaciones/gestion")}>
              <Icons.editing className="mr-2 h-4 w-4" />
              <span>Gestionar operaciones</span>
              <CommandShortcut>⌘A</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Cuentas">
            <p className="ml-2 mt-1 text-xs text-muted-foreground">Entidades</p>
            {entities.map((entity) => (
              <CommandItem
                key={entity.id}
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
            <p className="ml-2 mt-1 text-xs text-muted-foreground">Tags</p>
            {tags.map((tag) => (
              <CommandItem
                key={tag.name}
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
            <CommandItem onSelect={() => handleSelect("/usuarios")}>
              <Icons.person className="mr-2 h-4 w-4" />
              <span>Mi usuario</span>
              <CommandShortcut>⌘U</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect("/usuarios/permisos")}>
              <Icons.settings className="mr-2 h-4 w-4" />
              <span>Permisos</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect("/usuarios/roles")}>
              <Icons.roles className="mr-2 h-4 w-4" />
              <span>Roles</span>
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default CommandMenu;
