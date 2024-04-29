"use client";

import { useState, type FC } from "react";

import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import LoadingAnimation from "../components/LoadingAnimation";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import Log from "./Log";

interface TimelineProps {
  users: RouterOutputs["users"]["getAll"];
}

const Timeline: FC<TimelineProps> = ({ users }) => {
  const [page, setPage] = useState<number>(0);
  const [selectedUser, setSelectedUser] = useState<string>("todos");

  const pageSize = 8;

  const { data, isLoading, fetchNextPage } = api.logs.getLogs.useInfiniteQuery(
    {
      limit: pageSize,
      userId: selectedUser === "todos" ? undefined : selectedUser,
    },
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
    <div className="flex flex-col gap-8">
      <div className="flex w-full flex-row justify-start">
        <div className="flex flex-col justify-start gap-2">
          <Label>Usuario</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="flex flex-wrap">
              <SelectValue defaultValue="todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
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
          <Icons.chevronLeft className="h-5 w-5" />
        </Button>
        <p className="text-xl">{page + 1}</p>
        <Button
          variant="outline"
          onClick={() => handleFetchNextPage()}
          disabled={dataToRender && dataToRender.count === 0}
        >
          <Icons.chevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default Timeline;
