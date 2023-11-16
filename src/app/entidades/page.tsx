import { api } from "~/trpc/server";
import EntitiesFeed from "./EntitiesFeed";

const Page = async () => {
  const entities = await api.entities.getAll.query();

  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tighter">Entidades</h1>
      <EntitiesFeed initialEntities={entities} />
    </div>
  );
};

export default Page;
