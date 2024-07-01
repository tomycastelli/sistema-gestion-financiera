"use client";

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./ui/navigation-menu";
import { type FC } from "react";

interface NavMenuProps {
  menuItems: {
    name: string;
    links: { name: string; description: string; href: string }[];
  }[];
}

const NavMenu: FC<NavMenuProps> = ({ menuItems }) => {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        {menuItems.map((item) => (
          <NavigationMenuItem key={item.name}>
            <NavigationMenuTrigger>{item.name}</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="flex w-[300px] flex-col gap-y-2 p-4 md:w-[400px] lg:w-[500px]">
                {item.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="flex flex-col justify-start rounded-md p-2 transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <h2 className="text-sm font-medium leading-none">
                        {link.name}
                      </h2>
                      <p className="line-clamp-2 text-sm font-light leading-snug text-muted-foreground">
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
  );
};

export default NavMenu;
