import { api } from "~/trpc/server";
import AddRequest from "./AddRequest";
import Kanban from "./Kanban";
import { getUser } from "~/server/auth";

const Page = async () => {
  const initialRequests = await api.requests.getAll.query();

  const user = await getUser()

  const userPermissions = await api.users.getAllPermissions.query({});
  if (user) {
    return (
      <div className="flex flex-col items-center justify-center space-y-8">
        <h1 className="text-5xl font-semibold">Peticiones</h1>
        <div className="flex flex-row items-center space-x-2">
          <p>Añadir petición</p>
          <AddRequest user={user} />
        </div>
        <div className="h-screen w-full">
          <Kanban
            user={user}
            initialRequests={initialRequests}
            userPermissions={userPermissions}
          />
        </div>
      </div>
    );
  } else {
    return (
      <p className="text-3xl font-semibold">
        No se pueden ver las peticiones si el usuario no esta logueado
      </p>
    );
  }
};

export default Page;
