import type { Entities } from "@prisma/client";
import Link from "next/link";
import {
  capitalizeFirstLetter,
  getInitials,
  translateWord,
} from "~/lib/functions";
import { cn } from "~/lib/utils";
import { tagColors } from "~/lib/variables";
import { Icons } from "./Icons";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

interface EntityCardProps {
  entity: Entities | undefined;
  className?: string;
}

const EntityCard = ({ entity, className }: EntityCardProps) => {
  return (
    <>
      {entity ? (
        <Card
          className={cn(
            "flex h-36 w-36 flex-col",
            className,
            `border border-${tagColors[entity.tag]}`,
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
