"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { buttonVariants } from "../components/ui/button";

const Sidebar = () => {
  const pathname = usePathname();

  const { data: permissions } = api.users.getAllPermissions.useQuery({});

  return (
    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
      <Link
        prefetch={false}
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
          permission.name === "USERS_PERMISSIONS_VISUALIZE" ||
          permission.name.startsWith("USERS_PERMISSIONS_MANAGE"),
      ) && (
          <Link
            href="/usuarios/permisos"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              pathname.startsWith("/usuarios/permisos")
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
          permission.name === "USERS_ROLES_VISUALIZE" ||
          permission.name === "USERS_ROLES_MANAGE",
      ) && (
          <Link
            href="/usuarios/roles"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              pathname.startsWith("/usuarios/roles")
                ? "bg-muted hover:bg-muted"
                : "hover:bg-transparent hover:underline",
              "justify-start",
            )}
          >
            Roles
          </Link>
        )}
    </nav>
  );
};

export default Sidebar;
