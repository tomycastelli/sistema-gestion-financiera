import { getServerAuthSession } from "~/server/auth";

const Page = async () => {
  const session = await getServerAuthSession();

  return (
    <div>
      {session && <h1 className="text-xl font-bold">{session.user.name}</h1>}
    </div>
  );
};

export default Page;
