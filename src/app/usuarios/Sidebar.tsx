"use client";

import { type Session } from "next-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FC } from "react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { buttonVariants } from "../components/ui/button";

interface SidebarProps {
  session: Session;
}

const Sidebar: FC<SidebarProps> = ({ session }) => {
  const pathname = usePathname();

  const { data: permissions } = api.users.getAllPermissions.useQuery({});

  return (
    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
      <Link
        href="/usuarios"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          pathname === "/usuarios"
            ? "bg-muted hover:bg-muted"
            : "hover:bg-transparent hover:underline",
          "justify-start",
        )}
      >
        Mi usuario
      </Link>
      {permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_PERMISSIONS_VISUALIZE",
      ) && (
        <Link
          href="/usuarios/permisos"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            pathname === "/usuarios/permisos"
              ? "bg-muted hover:bg-muted"
              : "hover:bg-transparent hover:underline",
            "justify-start",
          )}
        >
          Permisos
        </Link>
      )}
      {permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_WHITELIST_VISUALIZE",
      ) && (
        <Link
          href="/usuarios/whitelist"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            pathname === "/usuarios/whitelist"
              ? "bg-muted hover:bg-muted"
              : "hover:bg-transparent hover:underline",
            "justify-start",
          )}
        >
          Whitelist
        </Link>
      )}
    </nav>
  );
};

export default Sidebar;
