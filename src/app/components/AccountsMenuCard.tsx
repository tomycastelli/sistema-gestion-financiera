import Link from "next/link";
import { api } from "~/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
const OperationsMenuCard = async () => {
  const filteredTags = await api.tags.getFiltered.query();
  const filteredEntities = await api.entities.getFiltered.query();

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
              prefetch={false}
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
