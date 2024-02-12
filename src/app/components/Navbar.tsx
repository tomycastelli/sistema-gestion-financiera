import Link from "next/link";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import LinkTree from "./LinkTree";
import { ThemeToggler } from "./ThemeToggler";
import CommandMenu from "./ui/CommandMenu";

const Navbar = async () => {
  const session = await getServerAuthSession();
  const userPermissions = await api.users.getAllPermissions.query({});

  return (
    <header className="h-fit w-full py-4 text-foreground">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-end justify-start space-x-2">
          <Link
            prefetch={false}
            href="/"
            className="rounded-xl bg-foreground p-2 text-2xl font-extrabold text-background"
          >
            Maika.
          </Link>
          <p className="text-sm text-muted-foreground dark:text-white">
            v0.1.4-2
          </p>
        </div>
        {session?.user && (
          <div className="hidden sm:block">
            <LinkTree />
          </div>
        )}
        {session?.user && (
          <div className="flex flex-row items-center space-x-4">
            <CommandMenu
              userPermissons={userPermissions}
              tags={await api.tags.getFiltered.query()}
              entities={await api.entities.getFiltered.query({
                permissionName: "ACCOUNTS_VISUALIZE",
              })}
            />
            <ThemeToggler />
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
