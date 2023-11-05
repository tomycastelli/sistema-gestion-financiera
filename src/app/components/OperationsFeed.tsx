"use client";

import { useState, type FC } from "react";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import Operation from "./Operation";
import { Button } from "./ui/button";
import { Icons } from "./ui/icons";

interface OperationsFeedProps {
  initialOperations: RouterOutputs["operations"]["getOperations"];
}

const OperationsFeed: FC<OperationsFeedProps> = ({ initialOperations }) => {
  const [page, setPage] = useState<number>(1);
  const { data: operations } = api.operations.getOperations.useQuery(
    {
      limit: 8,
      page: page,
    },
    {
      initialData: initialOperations,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  );

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-1 gap-4">
        {operations.map((op) => {
          return (
            <div key={op.id}>
              <Operation operation={op} />
            </div>
          );
        })}
      </div>
      <div className="w-full justify-end">
        <Button variant="outline" onClick={() => setPage(page + 1)}>
          <Icons.chevronRight className="h-8" />
        </Button>
      </div>
    </div>
  );
};

export default OperationsFeed;
