import Link from "next/link";
import { getUser } from "~/server/auth";
import { ThemeToggler } from "./ThemeToggler";
import UserInfo from "./UserInfo";
import CommandMenu from "./ui/CommandMenu";
import { Suspense } from "react";
import LoadingAnimation from "./LoadingAnimation";
import ChatsNav from "./ChatsNav";
import NavMenu from "./NavMenu";
import { api } from "~/trpc/server";
import { getAllChildrenTags } from "~/lib/functions";
import { Button } from "./ui/button";
import { Icons } from "./ui/Icons";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { env } from "~/env.mjs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const Navbar = async () => {
  const user = await getUser();

  const tags = await api.tags.getAll.query();

  const { data: mainTagData } = await api.globalSettings.get.query({
    name: "mainTag",
  });

  const mainTag = mainTagData as { tag: string };

  const mainTags = getAllChildrenTags(mainTag.tag, tags);

  interface MenuItem {
    name: string;
    links: { name: string; description: string; href: string }[];
  }

  const menuItems: MenuItem[] = [
    {
      name: "Operaciones",
      links: [
        {
          name: "Carga",
          description: "Ingresar operaciones",
          href: "/operaciones/carga",
        },
        {
          name: "Gestión",
          description:
            "Visualizar, cancelar, confirmar y modificar operaciones",
          href: "/operaciones/gestion?pagina=1",
        },
      ],
    },
    {
      name: "Cuentas",
      links: [
        {
          name: "Caja",
          description: "Las cuentas de caja",
          href: `/cuentas?tag=${mainTag.tag}&cuenta=caja`,
        },
        {
          name: "Cuenta corriente",
          description: "Las cuentas de cuenta corriente",
          href: `/cuentas?tag=${mainTag.tag}&cuenta=cuenta_corriente`,
        },
      ],
    },
    {
      name: "Entidades",
      links: [
        {
          name: "Gestión",
          description: "Crear, editar o eliminar Entidades y Tags",
          href: "/entidades",
        },
        {
          name: "Gráfico",
          description: "Visualizar el arbol de Tags",
          href: "/entidades/grafico",
        },
      ],
    },
    {
      name: "Preferencias",
      links: [
        {
          name: "Ajustes globales",
          description: "Ajustes globales del sistema",
          href: "/preferencias",
        },
        {
          name: "Mi usuario",
          description: "Manejar mi usuario",
          href: "/preferencias/usuarios",
        },
        {
          name: "Permisos",
          description: "Modificar los permisos de usuario",
          href: "/preferencias/usuarios/permisos",
        },
        {
          name: "Roles",
          description: "Manejar grupos de usuarios bajo un grupo de permisos",
          href: "/preferencias/usuarios/roles",
        },
      ],
    },
  ];

  return (
    <header className="h-fit w-full py-4 text-foreground">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-end justify-start space-x-2">
          <Link
            prefetch={false}
            href="/"
            className="rounded-xl bg-foreground p-2 text-2xl font-extrabold text-background"
          >
            {env.NEXT_PUBLIC_MAIN_NAME}.
          </Link>
          <p className="text-sm text-muted-foreground dark:text-white">
            v0.5.0
          </p>
        </div>
        <div className="hidden lg:block">
          {user && <NavMenu menuItems={menuItems} />}
        </div>
        {user && (
          <div className="hidden lg:block">
            <div className="flex flex-row items-center gap-x-4">
              <Suspense
                fallback={<LoadingAnimation text="Cargando chats" size="sm" />}
              >
                <ChatsNav />
              </Suspense>
              <UserInfo user={user} />
              <CommandMenu mainTags={mainTags} />
              <ThemeToggler />
            </div>
          </div>
        )}
        {user && (
          <div className="flex flex-row justify-end gap-x-4 lg:hidden">
            <ThemeToggler />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="p-3">
                  <Icons.settings className="h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent tw="w-full flex flex-col gap-y-4" side="right">
                <div className="my-4 flex w-full flex-col justify-end gap-y-4">
                  <Accordion
                    type="single"
                    collapsible
                    className="flex-flex-col w-full justify-end gap-y-2"
                  >
                    {menuItems.map((item) => (
                      <AccordionItem
                        value={item.name}
                        key={item.name}
                        className="flex flex-col justify-end gap-y-1"
                      >
                        <AccordionTrigger className="text-lg font-semibold">
                          {item.name}
                        </AccordionTrigger>
                        <AccordionContent className="flex flex-col gap-y-1">
                          {item.links.map((link) => (
                            <Link
                              key={link.name}
                              prefetch={false}
                              href={link.href}
                              className="flex flex-col gap-y-1 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              <h3 className="text-white">{link.name}</h3>
                              <p className="text-sm font-light text-muted-foreground">
                                {link.description}
                              </p>
                            </Link>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  <CommandMenu mainTags={mainTags} />
                  <UserInfo user={user} />
                  <Suspense
                    fallback={
                      <LoadingAnimation text="Cargando chats" size="sm" />
                    }
                  >
                    <ChatsNav />
                  </Suspense>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
