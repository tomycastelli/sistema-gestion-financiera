import Link from "next/link";
import { getUser } from "~/server/auth";
import LinkTree from "./LinkTree";
import { ThemeToggler } from "./ThemeToggler";
import UserInfo from "./UserInfo";
import CommandMenu from "./ui/CommandMenu";
import { Suspense } from "react";
import LoadingAnimation from "./LoadingAnimation";
import ChatsNav from "./ChatsNav";

const Navbar = async () => {
  const user = await getUser();

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
            v0.1.6-2
          </p>
        </div>
        <div className="hidden sm:block">
          <LinkTree />
        </div>
        {user && (
          <div className="flex flex-row items-center space-x-4">
            <Suspense fallback={<LoadingAnimation text="Cargando chats" size="sm" />}>
              <ChatsNav />
            </Suspense>
            <UserInfo user={user} />
            <CommandMenu />
            <ThemeToggler />
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
