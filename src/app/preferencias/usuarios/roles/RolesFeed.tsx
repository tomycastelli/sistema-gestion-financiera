"use client";

import dynamic from "next/dynamic";
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import Link from "next/link";
import { type FC } from "react";
import { toast } from "sonner";
import loadingJson from "~/../public/animations/loading.json";
import { Icons } from "~/app/components/ui/Icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/app/components/ui/alert-dialog";
import { Button } from "~/app/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

interface RolesFeedProps {
  initialRoles: RouterOutputs["roles"]["getAll"];
}

const RolesFeed: FC<RolesFeedProps> = ({ initialRoles }) => {
  const utils = api.useContext();

  const { data: roles, isLoading, isSuccess } = api.roles.getAll.useQuery(undefined, {
    initialData: initialRoles,
    refetchOnWindowFocus: false,
  });

  const { mutateAsync: deleteRole } = api.roles.deleteOne.useMutation({
    async onMutate(newOperation) {
      await utils.roles.getAll.cancel();

      const prevData = utils.roles.getAll.getData();

      utils.roles.getAll.setData(
        undefined,
        (old) => old?.filter((role) => role.id !== newOperation.id),
      );

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.roles.getAll.setData(undefined, ctx?.prevData);

      toast.error("No se pudo eliminar el rol", {
        description: err.message
      })
    },
    onSettled() {
      void utils.roles.getAll.invalidate();
    },
    onSuccess(data) {
      toast.success(`Rol ${data?.name} eliminado`)
    }
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {!isLoading ? (
        isSuccess && roles && roles.length > 0 ? (
          roles?.map((role) => (
            <Card
              key={role.id}
              className={cn(
                role.color === "red"
                  ? "border-red"
                  : role.color === "amber-400"
                    ? "border-amber-400"
                    : role.color === "green"
                      ? "border-green"
                      : role.color === "primary"
                        ? "border-primary"
                        : role.color === "violet-500"
                          ? "border-violet-500"
                          : role.color === "orange"
                            ? "border-orange"
                            : role.color === "pink-500"
                              ? "border-pink-500"
                              : role.color === "blue-400"
                                ? "border-blue-400"
                                : "border-gray-400",
              )}
            >
              <div className="mr-4 flex flex-row items-center justify-between">
                <CardHeader>
                  <CardTitle>
                    <Link href={`/preferencias/usuarios/roles/${role.id}`}>{role.name}</Link>
                  </CardTitle>
                  <CardDescription>
                    {
                      // @ts-ignore
                      role.permissions.length
                    }{" "}
                    permisos
                  </CardDescription>
                  <CardDescription>
                    {role.users ? role.users.length : 0}{" "}
                    {role.users ? role.users.length === 1 ? "usuario" : "usuarios" : ""}
                  </CardDescription>
                </CardHeader>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-transparent p-1"
                    >
                      <Icons.cross className="h-6" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminar este rol</AlertDialogTitle>
                      <AlertDialogDescription>
                        {role.users ? role.users.length : 0} usuarios dependen
                        de él
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteRole({ id: role.id })}
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))
        ) : (
          <p className="text-xl text-muted-foreground">No hay roles creados</p>
        )
      ) : (
        <Lottie animationData={loadingJson} className="h-24" loop={true} />
      )}
    </div>
  );
};

export default RolesFeed;
