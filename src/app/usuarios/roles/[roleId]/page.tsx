import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import ChangeRole from "./ChangeRole";
import ManageUsers from "./ManageUsers";
import RoleHeader from "./RoleHeader";

const Page = async ({ params }: { params: { roleId: string } }) => {
  const user = await getUser();
  const role = await api.roles.getById.query({ id: parseInt(params.roleId) });
  const entities = await api.entities.getAll.query();
  const tags = await api.tags.getAll.query();
  const users = await api.users.getAll.query();
  const userPermissions = await api.users.getAllPermissions.query({});
  const roles = await api.roles.getAll.query();

  return (
    <div>
      {role && user ? (
        <div className="flex flex-col space-y-6">
          <RoleHeader initialRole={role} />
          {userPermissions?.find(
            (p) => p.name === "ADMIN" || p.name === "USERS_ROLES_MANAGE",
          ) && <ManageUsers initialRole={role} initialUsers={users} />}
          <ChangeRole
            roles={roles}
            user={users.find((u) => u.id === user.id)}
            userPermissions={userPermissions}
            role={role}
            initialEntities={entities}
            initialTags={tags}
          />
        </div>
      ) : (
        <p>Rol no encontrado</p>
      )}
    </div>
  );
};

export default Page;
