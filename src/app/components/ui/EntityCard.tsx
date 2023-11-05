import type { Entities } from "@prisma/client";
import { capitalizeFirstLetter, getInitials } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { tagColors } from "~/lib/variables";

interface EntityCardProps {
  entity: Entities | undefined;
  className?: string;
}

const EntityCard = ({ entity, className }: EntityCardProps) => {
  return (
    <>
      {entity ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 py-6",
            className,
            `border-${tagColors[entity.tag]}`,
          )}
        >
          <h1 className="text-xl font-bold">{getInitials(entity.name)}</h1>
          <h2 className="text-xl">{capitalizeFirstLetter(entity.tag)}</h2>
        </div>
      ) : (
        <p>Entity not found</p>
      )}
    </>
  );
};

export default EntityCard;
