"use client";

import { useState, type FC } from "react";

import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import LoadingAnimation from "../components/LoadingAnimation";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import Log from "./Log";

interface TimelineProps {
  users: RouterOutputs["users"]["getAll"];
}

const Timeline: FC<TimelineProps> = ({ users }) => {
  const [page, setPage] = useState<number>(0);

  const { data, isLoading, fetchNextPage } = api.logs.getLogs.useInfiniteQuery(
    { limit: 8, page: page },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const handleFetchNextPage = async () => {
    await fetchNextPage();
    setPage(page + 1);
  };

  const handleFetchPreviousPage = () => {
    setPage(page - 1);
  };

  const dataToRender = data?.pages[page];

  return (
    <div className="flex flex-col space-y-8">
      {!isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {dataToRender &&
            dataToRender.logs.map((log) => (
              <Log log={log} users={users} key={log.sk} />
            ))}
        </div>
      ) : (
        <LoadingAnimation text={"Cargando logs"} />
      )}
      <div className="flex flex-row items-center justify-end space-x-4">
        <Button
          variant="outline"
          onClick={() => handleFetchPreviousPage()}
          disabled={page === 0}
        >
          <Icons.chevronLeft className="h-5 w-5 text-black" />
        </Button>
        <p className="text-xl">{page + 1}</p>
        <Button
          variant="outline"
          onClick={() => handleFetchNextPage()}
          disabled={!!dataToRender?.count && dataToRender.count < 8}
        >
          <Icons.chevronRight className="h-5 w-5 text-black" />
        </Button>
      </div>
    </div>
  );
};

export default Timeline;
