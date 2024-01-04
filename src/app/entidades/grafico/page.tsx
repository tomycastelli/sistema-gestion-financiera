import { api } from "~/trpc/server";
import FlowProvider from "./FlowProvider";

const Page = async () => {
  const tags = await api.tags.getAll.query();
  const entities = await api.entities.getAll.query();

  const groupedEntites = entities.reduce(
    (acc, entity) => {
      const tagNamesEntry = acc.find(
        (entry) => entry.tag.name === entity.tag.name,
      );

      if (!tagNamesEntry) {
        acc.push(entity);
      } else {
        if (
          acc.filter((entry) => entry.tag.name === tagNamesEntry.tag.name)
            .length < 5
        ) {
          acc.push(entity);
        }
      }

      return acc;
    },
    [] as typeof entities,
  );

  return (
    <div>
      <FlowProvider initialEntities={groupedEntites} initialTags={tags} />
      <p className="mt-4">
        **Se muestran solo 5 entidades por tag para la representación gráfica
      </p>
    </div>
  );
};

export default Page;
