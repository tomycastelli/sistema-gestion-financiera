import { getUser } from "~/server/auth";
import MyUserForm from "./MyUserForm";
import { api } from "~/trpc/server";

const Page = async () => {
  const user = await getUser();
  const entities = await api.entities.getAll.query();
  const main_name = await api.globalSettings.getMainName.query();

  return (
    <div className="space-y-6">
      {user && (
        <MyUserForm user={user} entities={entities} main_name={main_name} />
      )}
    </div>
  );
};

export default Page;
