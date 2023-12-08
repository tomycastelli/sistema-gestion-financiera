import Link from "next/link";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import LinkTree from "./LinkTree";
import CommandMenu from "./ui/CommandMenu";

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
        {session?.user && (
          <div className="flex flex-row space-x-4">
            <CommandMenu
              tags={await api.tags.getFiltered.query()}
              entities={await api.entities.getFiltered.query()}
            />
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
