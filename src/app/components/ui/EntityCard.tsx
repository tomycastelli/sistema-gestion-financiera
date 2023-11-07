import type { Entities } from "@prisma/client";
import {
  capitalizeFirstLetter,
  getInitials,
  translateWord,
} from "~/lib/functions";
import { cn } from "~/lib/utils";
import { tagColors } from "~/lib/variables";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";

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
            "flex h-36 w-36 items-center justify-center",
            className,
            `border border-${tagColors[entity.tag]}`,
          )}
        >
          <CardHeader>
            <CardTitle>{entity.name}</CardTitle>
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
