import { getServerAuthSession } from "~/server/auth";
import MyUserForm from "./MyUserForm";

const Page = async () => {
  const session = await getServerAuthSession();

  return (
    <div className="space-y-6">
      {session && <MyUserForm session={session} />}
    </div>
  );
};

export default Page;
