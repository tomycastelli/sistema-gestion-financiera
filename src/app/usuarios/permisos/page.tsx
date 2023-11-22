import Link from "next/link";
import { api } from "~/trpc/server";

const Page = async () => {
  const permissions = await api.users.getAllPermissions.query({});
  const users = await api.users.getAll.query();

  return (
    <>
      {permissions && (
        <div className="space-y-8">
          <div>
            {permissions?.find(
              (permission) =>
                permission.name === "ADMIN" ||
                permission.name === "USERS_ROLES_VISUALIZE",
            ) && (
              <div className="flex flex-col space-y-4">
                <h1 className="text-xl font-semibold tracking-tight">Roles</h1>
              </div>
            )}
          </div>
          <div>
            {permissions?.find(
              (permission) =>
                permission.name === "ADMIN" ||
                permission.name === "USERS_PERMISSIONS_VISUALIZE",
            ) && (
              <div className="flex flex-col space-y-4">
                <h1 className="text-xl font-semibold tracking-tight">
                  Permisos
                </h1>
                <div className="grid grid-cols-5 gap-2">
                  {users.map((user) => (
                    <Link
                      href={`/usuarios/permisos/${user.id}`}
                      key={user.id}
                      className="flex flex-col items-center justify-center space-y-1 rounded-xl border border-muted p-4 transition-all hover:scale-105"
                    >
                      <h1 className="text-lg font-semibold">{user.name}</h1>
                      <p>{user.email}</p>
                      <p className="text-muted-foreground">
                        {
                          // @ts-ignore
                          user.permissions.length
                        }{" "}
                        {
                          // @ts-ignore
                          user.permissions.length > 1 ? "Permisos" : "Permiso"
                        }
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Page;
