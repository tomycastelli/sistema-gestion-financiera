import Link from "next/link";
import { getAllChildrenTags } from "~/lib/functions";
import { api } from "~/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

const OperationsMenuCard = async () => {
  const tags = await api.tags.getAll.query();
  const entities = await api.entities.getAll.query();
  const userPermissions = await api.users.getAllPermissions.query({});

  const filteredTags = tags.filter((tag) => {
    if (
      userPermissions?.find(
        (p) => p.name === "ADMIN" || p.name === "ACCOUNTS_VISUALIZE",
      )
    ) {
      return true;
    } else if (
      userPermissions?.find(
        (p) =>
          p.name === "ACCOUNTS_VISUALIZE_SOME" &&
          getAllChildrenTags(p.entitiesTags, tags).includes(tag.name),
      )
    ) {
      return true;
    }
  });

  const filteredEntities = entities.filter((entity) => {
    if (
      userPermissions?.find(
        (p) => p.name === "ADMIN" || p.name === "ACCOUNTS_VISUALIZE",
      )
    ) {
      return true;
    } else if (
      userPermissions?.find(
        (p) =>
          p.name === "ACCOUNTS_VISUALIZE_SOME" &&
          (p.entitiesIds?.includes(entity.id) ||
            getAllChildrenTags(p.entitiesTags, tags).includes(entity.tag.name)),
      )
    ) {
      return true;
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl">Cuentas</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="flex h-80 w-full flex-col rounded-md">
          <h4 className="mb-2 text-3xl font-semibold leading-none">Tags</h4>
          {filteredTags.map((tag) => (
            <Link
              key={tag.name}
              className={`mb-2 flex flex-row space-x-2 pl-2 text-xl hover:border-l-8 hover:border-primary hover:transition-all`}
              href={{ pathname: "/cuentas", query: { tag: tag.name } }}
            >
              <p>{tag.name}</p>
              <p className="text-muted-foreground">{tag.parent}</p>
            </Link>
          ))}
          <h4 className="mb-2 mt-2 text-3xl font-semibold leading-none">
            Entidades
          </h4>
          {filteredEntities.map((entity) => (
            <Link
              key={entity.name}
              className={`mb-2 flex flex-row space-x-2 pl-2 text-xl hover:border-l-8 hover:border-primary hover:transition-all`}
              href={{ pathname: "/cuentas", query: { entidad: entity.id } }}
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
