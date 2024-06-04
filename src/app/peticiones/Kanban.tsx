"use client";

import { type FC } from "react";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import LoadingAnimation from "../components/LoadingAnimation";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import UpdateRequest from "./UpdateRequest";
import { type User } from "lucia";
import { toast } from "sonner";

interface KanbanProps {
  initialRequests: RouterOutputs["requests"]["getAll"];
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  user: User
}

const Kanban: FC<KanbanProps> = ({
  initialRequests,
  userPermissions,
  user
}) => {
  const utils = api.useContext();

  const { data: requests, isLoading } = api.requests.getAll.useQuery(
    undefined,
    { initialData: initialRequests, refetchOnWindowFocus: false },
  );

  const { mutateAsync: deleteAsync } = api.requests.deleteOne.useMutation({
    async onMutate(newOperation) {
      await utils.requests.getAll.cancel();

      const prevData = utils.requests.getAll.getData(undefined);

      utils.requests.getAll.setData(undefined, (old) =>
        old ? old.filter((r) => r.id !== newOperation.id) : [],
      );

      return { prevData };
    },
    onError(err) {
      const prevData = utils.requests.getAll.getData(undefined);
      // Doing some ui actions
      toast.error("No se pudo eliminar la petición", {
        description: err.message
      })
      return { prevData };
    },
    onSettled() {
      void utils.requests.getAll.invalidate();
    },
    onSuccess() {
      toast.success("Petición eliminada")
    },
  });

  return (
    <div className="grid h-full w-full grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-row items-center justify-start space-x-2">
          <span className="rounded-full bg-muted-foreground p-4"></span>
          <h1 className="text-2xl font-semibold">Pendientes</h1>
        </div>
        <Separator />
        <div className="flex flex-col space-y-4">
          {!isLoading ? (
            requests
              .filter((r) => r.status === "pending")
              .map((r) => (
                <Card key={r.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{r.title}</CardTitle>
                    <div className="flex flex-row space-x-2">
                      {userPermissions &&
                        userPermissions.find((p) => p.name === "ADMIN") && (
                          <Button
                            variant="outline"
                            onClick={() => deleteAsync({ id: r.id })}
                          >
                            <Icons.cross className="h-5 text-red" />
                          </Button>
                        )}
                      {r.uploadedBy === user.id && (
                        <UpdateRequest request={r} />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col space-y-2">
                    <p>{r.content}</p>
                    <p className="text-muted">{r.developerMessage}</p>
                  </CardContent>
                  <CardFooter className="flex flex-row items-center justify-start">
                    <Icons.person className="mr-2 h-5 w-5" />
                    <p>{r.uploadedByUser.name}</p>
                  </CardFooter>
                </Card>
              ))
          ) : (
            <LoadingAnimation text="Cargando peticiones" />
          )}
        </div>
      </div>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-row items-center justify-start space-x-2">
          <span className="rounded-full bg-yellow p-4"></span>
          <h1 className="text-2xl font-semibold">En proceso</h1>
        </div>
        <Separator />
        <div className="flex flex-col space-y-4">
          {!isLoading ? (
            requests
              .filter((r) => r.status === "working")
              .map((r) => (
                <Card key={r.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{r.title}</CardTitle>
                    <UpdateRequest request={r} />
                  </CardHeader>
                  <CardContent className="flex flex-col space-y-2">
                    <p>{r.content}</p>
                    <p className="text-yellow">{r.developerMessage}</p>
                  </CardContent>
                  <CardFooter className="flex flex-row items-center justify-start">
                    <Icons.person className="mr-2 h-5 w-5" />
                    <p>{r.uploadedByUser.name}</p>
                  </CardFooter>
                </Card>
              ))
          ) : (
            <LoadingAnimation text="Cargando peticiones" />
          )}
        </div>
      </div>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-row items-center justify-start space-x-2">
          <span className="rounded-full bg-green p-4"></span>
          <h1 className="text-2xl font-semibold">Completadas</h1>
        </div>
        <Separator />
        <div className="flex flex-col space-y-4">
          {!isLoading ? (
            requests
              .filter((r) => r.status === "finished")
              .map((r) => (
                <Card key={r.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{r.title}</CardTitle>
                    <UpdateRequest request={r} />
                  </CardHeader>
                  <CardContent className="flex flex-col space-y-2">
                    <p>{r.content}</p>
                    <p className="text-green">{r.developerMessage}</p>
                  </CardContent>
                  <CardFooter className="flex flex-row items-center justify-start">
                    <Icons.person className="mr-2 h-5 w-5" />
                    <p>{r.uploadedByUser.name}</p>
                  </CardFooter>
                </Card>
              ))
          ) : (
            <LoadingAnimation text="Cargando peticiones" />
          )}
        </div>
      </div>
    </div>
  );
};

export default Kanban;
