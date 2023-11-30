import { api } from "~/trpc/server";
import AddRoleForm from "./AddRoleForm";
import RolesFeed from "./RolesFeed";

const Page = async () => {
  const roles = await api.roles.getAll.query();
  const entities = await api.entities.getAll.query();
  const tags = await api.tags.getAll.query();
  const permissions = await api.users.getAllPermissions.query({});

  return (
    <div className="flex flex-col space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Roles</h1>
      <RolesFeed initialRoles={roles} />
      {permissions?.find(
        (permission) =>
          permission.name === "USERS_ROLES_MANAGE" ||
          permission.name === "ADMIN",
      ) ? (
        <div className="flex flex-col space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">Nuevo rol</h1>
          <AddRoleForm
            initialEntities={entities}
            initialTags={tags}
            userPermissions={permissions}
          />
        </div>
      ) : (
        <p></p>
      )}
    </div>
  );
};

export default Page;
