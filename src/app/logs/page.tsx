import { api } from "~/trpc/server";
import Timeline from "./Timeline";

const Page = async () => {
  const initialLogs = await api.logs.getLogs.query({ limit: 8, page: 1 });
  const users = await api.users.getAll.query();

  return (
    <div>
      <Timeline initialLogs={initialLogs} users={users} />
    </div>
  );
};

export default Page;
