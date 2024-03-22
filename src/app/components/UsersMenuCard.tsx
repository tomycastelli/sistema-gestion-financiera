import Link from "next/link";
import { api } from "~/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const OperationsMenuCard = async () => {
  const userPermissions = await api.users.getAllPermissions.query();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl">Usuarios</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <Link
            prefetch={false}
            href={"/usuarios"}
            className="flex p-4 transition-all hover:border-l-8 hover:border-primary"
          >
            <h1 className="text-3xl font-semibold tracking-tight">
              Mi usuario
            </h1>
          </Link>
          {userPermissions?.find(
            (p) =>
              p.name === "ADMIN" ||
              p.name.startsWith("USERS_PERMISSIONS_MANAGE") ||
              p.name === "USERS_PERMISSIONS_VISUALIZE",
          ) && (
              <Link
                prefetch={false}
                href={"/usuarios/permisos"}
                className="flex p-4 transition-all hover:border-l-8 hover:border-primary"
              >
                <h1 className="text-3xl font-semibold tracking-tight">
                  Permisos
                </h1>
              </Link>
            )}
          {userPermissions?.find(
            (p) =>
              p.name === "ADMIN" ||
              p.name === "USERS_ROLES_MANAGE" ||
              p.name === "USERS_ROLES_VISUALIZE",
          ) && (
              <Link
                prefetch={false}
                href={"/usuarios/roles"}
                className="flex p-4 transition-all hover:border-l-8 hover:border-primary"
              >
                <h1 className="text-3xl font-semibold tracking-tight">Roles</h1>
              </Link>
            )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OperationsMenuCard;
