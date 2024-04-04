"use client";

import { type FC } from "react";
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
import { toast } from "sonner";

interface EntityOptionsProps {
  entity: RouterOutputs["entities"]["getAll"][number];
  tags: RouterOutputs["tags"]["getAll"]
}

const EntityOptions: FC<EntityOptionsProps> = ({ entity, tags }) => {
  const utils = api.useContext();

  const { mutateAsync: deleteAsync } = api.entities.deleteOne.useMutation({
    async onMutate() {

      // Doing the Optimistic update
      await utils.entities.getAll.cancel();

      const prevData = utils.entities.getAll.getData();

      utils.entities.getAll.setData(undefined, (old) => [
        // @ts-ignore
        ...old.filter((item) => item.id !== entity.id),
      ]);

      return { prevData };
    },
    onError(err, newOperation, ctx) {
      utils.entities.getAll.setData(undefined, ctx?.prevData);

      toast.error(`No se pudo eliminar la entidad ${newOperation.entityId}`, {
        description: JSON.stringify(err.message)
      })
    },
    onSettled() {
      void utils.entities.getAll.invalidate();
    },
    onSuccess(data) {
      toast.success(`Entidad ${data.id} eliminada`)
    }
  });

  return (
    <div className="mx-auto flex w-2/3 flex-row space-x-4">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="border-transparent p-1">
            <Icons.cross className="h-6 text-red" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la entidad (si la misma no tiene transacciones
              relacionadas)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red"
              onClick={() => deleteAsync({ entityId: entity.id, tag: entity.tag.name })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChangeEntityForm entity={entity} tags={tags} />
    </div>
  );
};

export default EntityOptions;
