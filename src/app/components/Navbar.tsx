import Link from "next/link";
import { getServerAuthSession } from "~/server/auth";
import LinkTree from "./LinkTree";
import UserDropdown from "./UserDropdown";

const Navbar = async () => {
  const session = await getServerAuthSession();

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
        {session?.user ? (
          <UserDropdown />
        ) : (
          <Link className="text-lg font-semibold" href="/login">
            Ingresar
          </Link>
        )}
      </div>
    </header>
  );
};

export default Navbar;
