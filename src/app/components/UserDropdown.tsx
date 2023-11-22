"use client";

import { Keyboard, LogOut, Settings, User, Users } from "lucide-react";
import { type Session } from "next-auth";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { RouterOutputs } from "~/trpc/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const logout = async () => {
  await signOut();
};

const UserDropdown = ({
  session,
  initialPermissions,
}: {
  session: Session;
  initialPermissions: RouterOutputs["users"]["getAllPermissions"];
}) => {
  const router = useRouter();
  const { data: permissions } = api.users.getAllPermissions.useQuery(
    {},
    { initialData: initialPermissions },
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <User className="h-8 w-8" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="absolute right-0 z-10 mt-2 w-56">
        <DropdownMenuLabel>{session.user.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/usuarios")}>
            <User className="mr-2 h-4 w-4" />
            <span>Mi usuario</span>
          </DropdownMenuItem>
          {permissions &&
            permissions.find(
              (permission) =>
                permission.name === "USERS_PERMISSIONS_VISUALIZE" ||
                permission.name === "ADMIN",
            ) && (
              <DropdownMenuItem
                onClick={() => router.push("/usuarios/permisos")}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Permisos</span>
              </DropdownMenuItem>
            )}
          <DropdownMenuItem>
            <Keyboard className="mr-2 h-4 w-4" />
            <span>Keyboard shortcuts</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {permissions &&
            permissions.find(
              (permission) =>
                permission.name === "USERS_WHITELIST_VISUALIZE" ||
                permission.name === "ADMIN",
            ) && (
              <DropdownMenuItem
                onClick={() => router.push("/usuarios/whitelist")}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Whitelist</span>
              </DropdownMenuItem>
            )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;
