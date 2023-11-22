import Link from "next/link";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import LinkTree from "./LinkTree";
import UserDropdown from "./UserDropdown";

const Navbar = async () => {
  const session = await getServerAuthSession();
  const permissions = await api.users.getAllPermissions.query({});

  return (
    <header className="h-fit w-full py-4 text-foreground">
      <div className="flex flex-row items-center justify-between">
        <Link
          href="/"
          className="rounded-xl bg-foreground p-2 text-2xl font-extrabold text-background"
        >
          Maika.
        </Link>
        {session?.user && <LinkTree />}
        {session?.user && (
          <UserDropdown session={session} initialPermissions={permissions} />
        )}
      </div>
    </header>
  );
};

export default Navbar;
