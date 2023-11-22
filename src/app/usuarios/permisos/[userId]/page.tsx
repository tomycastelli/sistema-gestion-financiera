import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import PermissionsForm from "./PermissionsForm";

export default async function Page({ params }: { params: { userId: string } }) {
  const permissions = await api.users.getUserPermissions.query({
    id: params.userId,
  });

  const entities = await api.entities.getAll.query();

  const session = await getServerAuthSession();

  return (
    <div>
      {session && (
        <PermissionsForm
          initialEntities={entities}
          initialPermissions={permissions}
          userId={params.userId}
          session={session}
        />
      )}
    </div>
  );
}
