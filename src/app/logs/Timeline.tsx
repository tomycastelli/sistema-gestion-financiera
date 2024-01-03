"use client";

import { type FC } from "react";

import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import CustomPagination from "../components/CustomPagination";
import LoadingAnimation from "../components/LoadingAnimation";
import Log from "./Log";

interface TimelineProps {
  initialLogs: RouterOutputs["logs"]["getLogs"];
  users: RouterOutputs["users"]["getAll"];
}

const Timeline: FC<TimelineProps> = ({ initialLogs, users }) => {
  const searchParams = useSearchParams();
  const pageString = searchParams.get("pagina");
  const page = pageString ? parseInt(pageString) : 1;
  const { data, isLoading } = api.logs.getLogs.useQuery(
    { limit: 8, page: page },
    { initialData: initialLogs },
  );

  return (
    <div className="mx-36 flex flex-col space-y-8">
      {!isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {data.logs.map((log) => (
            <Log log={log} users={users} key={log.id} />
          ))}
        </div>
      ) : (
        <LoadingAnimation text={"Cargando logs"} />
      )}
      <div className="flex flex-row items-center justify-end space-x-4">
        <CustomPagination
          pathname="/logs"
          page={page}
          pageSize={8}
          totalCount={data.count}
          itemName="logs"
        />
      </div>
    </div>
  );
};

export default Timeline;
