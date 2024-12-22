import { getUser } from "~/server/auth";
import MyUserForm from "./MyUserForm";
import { api } from "~/trpc/server";

const Page = async () => {
  const user = await getUser();
  const entities = await api.entities.getAll.query();

  return (
    <div className="space-y-6">
      {user && <MyUserForm user={user} entities={entities} />}
    </div>
  );
};

export default Page;
