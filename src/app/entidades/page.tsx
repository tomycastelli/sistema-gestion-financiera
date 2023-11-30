import Link from "next/link";
import { api } from "~/trpc/server";
import EntitiesFeed from "./EntitiesFeed";

const Page = async () => {
  const entities = await api.entities.getAll.query();
  const initialTags = await api.tags.getAll.query();
  const userPermissions = await api.users.getAllPermissions.query({});

  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tighter">Entidades</h1>
      <Link href="/entidades/grafico">
        <h1 className="text-2xl tracking-tighter">Gráfico</h1>
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
