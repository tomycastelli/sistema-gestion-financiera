import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import AddRequest from "./AddRequest";
import Kanban from "./Kanban";

const Page = async () => {
  const initialRequests = await api.requests.getAll.query();

  const session = await getServerAuthSession();

  const userPermissions = await api.users.getAllPermissions.query({});

  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      <h1 className="text-4xl font-semibold">Peticiones</h1>
      {session && (
        <div className="flex flex-row items-center space-x-2">
          <p>Añadir petición</p>
          <AddRequest session={session} />
        </div>
      )}
      <div className="h-screen w-full">
        <Kanban
          initialRequests={initialRequests}
          userPermissions={userPermissions}
        />
      </div>
    </div>
  );
};

export default Page;
