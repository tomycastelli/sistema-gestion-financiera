import { api } from "~/trpc/server";
import FlowProvider from "./FlowProvider";

const Page = async () => {
  const tags = await api.tags.getAll.query();
  const entities = await api.entities.getAll.query();

  return (
    <div>
      <FlowProvider
        initialEntities={entities.slice(0, 10)}
        initialTags={tags}
      />
    </div>
  );
};

export default Page;
