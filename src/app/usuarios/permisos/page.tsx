import { api } from "~/trpc/server";
import UsersFeed from "./UsersFeed";

const Page = async () => {
  const permissions = await api.users.getAllPermissions.query({});
  const users = await api.users.getAll.query();

  return (
    <>
      {permissions &&
        permissions.find(
          (permission) =>
            permission.name === "ADMIN" ||
            permission.name === "USERS_PERMISSIONS_VISUALIZE",
        ) && (
          <div className="flex flex-col space-y-4">
            <h1 className="text-xl font-semibold tracking-tight">Permisos</h1>
            <UsersFeed initialUsers={users} />
          </div>
        )}
    </>
  );
};

export default Page;
