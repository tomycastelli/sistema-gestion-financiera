import Link from "next/link";
import { api } from "~/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { getAllChildrenTags } from "~/lib/functions";
const OperationsMenuCard = async () => {
  const filteredTags = await api.tags.getFiltered.query();
  const filteredEntities = await api.entities.getFiltered.query({
    permissionName: "ACCOUNTS_VISUALIZE",
  });

  const { data: mainTagData } = await api.globalSettings.get.query({ name: "mainTag" })

  const mainTag = mainTagData as { tag: string }

  const mainTags = getAllChildrenTags(mainTag.tag, filteredTags)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl">Cuentas</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="flex h-80 w-full flex-col rounded-md">
          <h4 className="mb-2 text-3xl font-semibold leading-none">Tags</h4>
          {mainTags.map((tag) => (
            <Link
              key={tag}
              className={`mb-2 flex flex-row space-x-2 pl-2 text-xl hover:border-l-8 hover:border-primary hover:transition-all`}
              href={{ pathname: "/cuentas", query: { tag: tag } }}
              prefetch={false}
            >
              <p>{tag}</p>
            </Link>
          ))}
          <h4 className="mb-2 mt-2 text-3xl font-semibold leading-none">
            Entidades
          </h4>
          {filteredEntities.filter(entity => mainTags.includes(entity.tag.name)).map((entity) => (
            <Link
              key={entity.name}
              className={`mb-2 flex flex-row space-x-2 pl-2 text-xl hover:border-l-8 hover:border-primary hover:transition-all`}
              href={{ pathname: "/cuentas", query: { entidad: entity.id } }}
              prefetch={false}
            >
              <p>{entity.name}</p>
              <p className="text-muted-foreground">{entity.tag.name}</p>
            </Link>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default OperationsMenuCard;
