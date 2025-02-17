import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import { Icons } from "../components/ui/Icons";
import EntitiesFeed from "./EntitiesFeed";

const Page = async () => {
  const user = await getUser();
  const entities = await api.entities.getAll.query();
  const initialTags = await api.tags.getFiltered.query();
  const userPermissions = await api.users.getAllPermissions.query();
  const main_name = await api.globalSettings.getMainName.query();

  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tighter">Entidades</h1>
      <Link
        prefetch={false}
        href="/entidades/grafico"
        className="mt-1 flex w-28 flex-row items-center justify-center space-x-2 rounded-xl bg-muted p-1 transition-all hover:scale-110"
      >
        <h1 className="text-2xl tracking-tighter">Gráfico</h1>
        <Icons.externalLink className="h-5" />
      </Link>
      <EntitiesFeed
        user={user}
        main_name={main_name}
        userPermissions={userPermissions}
        initialEntities={entities}
        initialTags={initialTags}
      />
    </div>
  );
};

export default Page;
