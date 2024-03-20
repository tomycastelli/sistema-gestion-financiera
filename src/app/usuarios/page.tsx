import { getUser } from "~/server/auth";
import MyUserForm from "./MyUserForm";

const Page = async () => {
  const user = await getUser()

  return (
    <div className="space-y-6">
      {user && <MyUserForm user={user} />}
    </div>
  );
};

export default Page;
