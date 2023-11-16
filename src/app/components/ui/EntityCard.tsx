import type { Entities } from "@prisma/client";
import Link from "next/link";
import { capitalizeFirstLetter, translateWord } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";

interface EntityCardProps {
  entity: Entities | undefined;
  className?: string;
}

const EntityCard = ({ entity }: EntityCardProps) => {
  return (
    <>
      {entity ? (
        <Card
          className={cn(
            "flex h-36 w-36 flex-col border",
            entity.tag === "maika"
              ? "border-green"
              : entity.tag === "client"
              ? "border-primary"
              : entity.tag === "user"
              ? "border-orange"
              : "",
          )}
        >
          <CardHeader>
            <CardTitle>
              <Link
                className="flex transition-all hover:scale-105"
                href={{ pathname: "/cuentas", query: { entidad: entity.id } }}
              >
                {entity.name}
              </Link>
            </CardTitle>
            <CardDescription className="text-md">
              {capitalizeFirstLetter(translateWord(entity.tag))}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <p>Entity not found</p>
      )}
    </>
  );
};

export default EntityCard;
