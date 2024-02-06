import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import MyUserForm from "./MyUserForm";

const Page = async () => {
  const session = await getServerAuthSession();

  const user = await api.users.getById.query({ id: session?.user.id ?? "" });

  return (
    <div className="space-y-6">
      {session && <MyUserForm initialUser={user} />}
    </div>
  );
};

export default Page;
