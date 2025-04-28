"use client";

import type { User } from "lucia";
import { type FC } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { Icons } from "../components/ui/Icons";
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
} from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import ChangeEntityForm from "./ChangeEntityForm";
import MigrateEntitiesDialog from "./MigrateEntitiesDialog";

interface EntityOptionsProps {
  entity: RouterOutputs["entities"]["getAll"][number];
  entities: RouterOutputs["entities"]["getAll"];
  tags: RouterOutputs["tags"]["getFiltered"];
  user: User;
}

const EntityOptions: FC<EntityOptionsProps> = ({
  entity,
  tags,
  user,
  entities,
}) => {
  const utils = api.useContext();

  const { mutateAsync: deleteAsync } =
    api.editingOperations.deleteEntityOperations.useMutation({
      async onMutate(newOperation) {
        // Doing the Optimistic update
        await utils.entities.getAll.cancel();

        const prevData = utils.entities.getAll.getData();

        utils.entities.getAll.setData(
          undefined,
          (old) => old?.filter((item) => item.id !== newOperation.entityId),
        );

        return { prevData };
      },
      onError(err, newOperation, ctx) {
        utils.entities.getAll.setData(undefined, ctx?.prevData);

        toast.error(`No se pudo eliminar la entidad ${newOperation.entityId}`, {
          description: JSON.stringify(err.message),
        });
      },
      onSettled() {
        void utils.entities.getAll.invalidate();
      },
      onSuccess(data, variables) {
        toast.success(
          `Entidad ${variables.entityId} eliminada, ${data.deletedOperations} operaciones eliminadas.`,
        );
      },
    });

  return (
    <div className="mx-auto flex w-2/3 flex-row justify-center gap-x-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            disabled={
              (user.email !== "christian@ifc.com.ar" &&
                user.email !== "tomas.castelli@ifc.com.ar") ||
              entity.name === "Pilar" ||
              entity.name === "Centro" ||
              entity.name === "Nordelta" ||
              entity.name === "BBVA" ||
              entity.name === "Madrid"
            }
            variant="outline"
            className="border-transparent p-1"
          >
            <Icons.cross className="h-6 text-red" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la entidad y{" "}
              <span className="font-semibold">
                todas sus transacciones relacionadas con todos los movimientos
                generados por estas
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red"
              onClick={() =>
                toast.warning(
                  "Tenés 20 segundos para detener esta eliminación",
                  {
                    duration: 20000,
                    action: {
                      label: "Detener",
                      onClick: () => {
                        return;
                      },
                    },
                    onAutoClose: () => {
                      void deleteAsync({ entityId: entity.id });
                    },
                  },
                )
              }
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ChangeEntityForm entity={entity} tags={tags} />
      <MigrateEntitiesDialog
        originEntity={entity}
        entities={entities}
        user={user}
      />
    </div>
  );
};

export default EntityOptions;
