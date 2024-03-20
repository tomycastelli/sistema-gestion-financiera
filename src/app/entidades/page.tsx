import Link from "next/link";
import { api } from "~/trpc/server";
import { Icons } from "../components/ui/Icons";
import EntitiesFeed from "./EntitiesFeed";

const Page = async () => {
  const entities = await api.entities.getAll.query();
  const initialTags = await api.tags.getFiltered.query();
  const userPermissions = await api.users.getAllPermissions.query({});

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
        userPermissions={userPermissions}
        initialEntities={entities}
        initialTags={initialTags}
      />
    </div>
  );
};

export default Page;
