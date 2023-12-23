import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import PermissionsForm from "./PermissionsForm";

export default async function Page({ params }: { params: { userId: string } }) {
  const permissions = await api.users.getUserPermissions.query({
    id: params.userId,
  });

  const entities = await api.entities.getAll.query();

  const session = await getServerAuthSession();

  const tags = await api.tags.getAll.query();

  const userPermissions = await api.users.getAllPermissions.query({});

  const initialRoles = await api.roles.getAll.query();

  return (
    <div>
      {session && (
        <PermissionsForm
          initialRoles={initialRoles}
          userPermissions={userPermissions}
          initialEntities={entities}
          initialPermissions={permissions}
          userId={params.userId}
          session={session}
          tags={tags}
        />
      )}
    </div>
  );
}
