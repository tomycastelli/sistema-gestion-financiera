import { api } from "~/trpc/server";
import Timeline from "./Timeline";

const Page = async () => {
  const initialLogs = await api.logs.getLogs.query({ limit: 8, page: 1 });
  const users = await api.users.getAll.query();
  const userPermissions = await api.users.getAllPermissions.query({});

  return (
    <div>
      {userPermissions?.find(
        (p) => p.name === "ADMIN" || p.name === "LOGS_VISUALIZE",
      ) ? (
        <Timeline initialLogs={initialLogs} users={users} />
      ) : (
        <h1 className="text-3xl font-semibold">
          El usuario no posee los permisos necesarios
        </h1>
      )}
    </div>
  );
};

export default Page;
