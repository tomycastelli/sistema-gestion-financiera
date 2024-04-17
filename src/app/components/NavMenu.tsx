"use client"

import Link from "next/link";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuList, NavigationMenuTrigger } from "./ui/navigation-menu";

const NavMenu = () => {
  interface MenuItem {
    name: string;
    links: { name: string; description: string, href: string }[]
  }
  const menuItems: MenuItem[] = [
    {
      name: "Operaciones",
      links: [
        { name: "Carga", description: "Ingresar operaciones", href: "/operaciones/carga" },
        { name: "Gestión", description: "Visualizar, cancelar, confirmar y modificar operaciones", href: "/operaciones/gestion?pagina=1" }
      ]
    },
    {
      name: "Cuentas",
      links: [
        { name: "Caja", description: "Las cuentas de caja", href: "/cuentas?tag=Maika&cuenta=caja" },
        { name: "Cuenta corriente", description: "Las cuentas de cuenta corriente", href: "/cuentas?tag=Maika&cuenta=cuenta_corriente" }
      ]
    },
    {
      name: "Entidades",
      links: [
        { name: "Gestión", description: "Crear, editar o eliminar Entidades y Tags", href: "/entidades" },
        { name: "Gráfico", description: "Visualizar el arbol de Tags", href: "/entidades/grafico" }
      ]
    },
    {
      name: "Preferencias",
      links: [
        { name: "Ajustes globales", description: "Ajustes globales del sistema", href: "/preferencias" },
        { name: "Mi usuario", description: "Manejar mi usuario", href: "/preferencias/usuarios" },
        { name: "Permisos", description: "Modificar los permisos de usuario", href: "/preferencias/usuarios/permisos" },
        { name: "Roles", description: "Manejar grupos de usuarios bajo un grupo de permisos", href: "/preferencias/usuarios/roles" }
      ]
    }
  ]

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {menuItems.map(item => (
          <NavigationMenuItem key={item.name}>
            <NavigationMenuTrigger>{item.name}</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="flex w-[300px] gap-y-2 p-4 md:w-[400px] flex-col lg:w-[500px]">
                {item.links.map(link => (
                  <li key={link.name}>
                    <Link href={link.href} className="flex flex-col justify-start p-2 rounded-xl transition-all hover:bg-gray-100">
                      <h2 className="text-sm font-medium leading-none">{link.name}</h2>
                      <p className="line-clamp-2 font-light text-sm leading-snug text-muted-foreground">
                        {link.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

export default NavMenu
