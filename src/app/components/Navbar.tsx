import Link from "next/link";
import { getUser } from "~/server/auth";
import { ThemeToggler } from "./ThemeToggler";
import UserInfo from "./UserInfo";
import CommandMenu from "./ui/CommandMenu";
import { Suspense } from "react";
import LoadingAnimation from "./LoadingAnimation";
import ChatsNav from "./ChatsNav";
import NavMenu from "./NavMenu";
import { api } from "~/trpc/server";
import { getAllChildrenTags } from "~/lib/functions";

const Navbar = async () => {
  const user = await getUser();

  const tags = await api.tags.getAll.query()

  const { data: mainTagData } = await api.globalSettings.get.query({ name: "mainTag" })

  const mainTag = mainTagData as { tag: string }

  const mainTags = getAllChildrenTags(mainTag.tag, tags)

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
            v0.1.1
          </p>
        </div>
        <div className="hidden sm:block">
          {user && (
            <NavMenu mainTag={mainTag.tag} />
          )}
        </div>
        {user && (
          <div className="flex flex-row items-center space-x-4">
            <Suspense fallback={<LoadingAnimation text="Cargando chats" size="sm" />}>
              <ChatsNav />
            </Suspense>
            <UserInfo user={user} />
            <CommandMenu mainTags={mainTags} />
            <ThemeToggler />
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
