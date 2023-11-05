import Link from "next/link";
import { getServerAuthSession } from "~/server/auth";
import UserDropdown from "./UserDropdown";

const Navbar = async () => {
  const session = await getServerAuthSession();

  return (
    <header className="h-fit w-full bg-foreground py-4 text-background">
      <div className="mx-16 flex flex-row items-center justify-between lg:mx-36">
        <div className="flex flex-row items-center justify-between space-x-8">
          <Link href="/" className="text-xl font-extrabold">
            Maika.
          </Link>
          <div className="flex flex-row space-x-4">
            <Link className="text-lg" href="/operaciones">
              Operaciones
            </Link>
          </div>
        </div>
        {session?.user ? (
          <UserDropdown />
        ) : (
          <Link className="text-lg" href="/login">
            Login
          </Link>
        )}
      </div>
    </header>
  );
};

export default Navbar;
