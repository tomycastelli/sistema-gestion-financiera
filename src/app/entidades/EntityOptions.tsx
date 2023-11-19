"use client";

import { type FC } from "react";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import { toast } from "../components/ui/use-toast";
import ChangeEntityForm from "./ChangeEntityForm";

interface EntityOptionsProps {
  entity: RouterOutputs["entities"]["getAll"][number];
}

const EntityOptions: FC<EntityOptionsProps> = ({ entity }) => {
  const utils = api.useContext();

  const { mutateAsync: deleteAsync } = api.entities.deleteOne.useMutation({
    async onMutate(newOperation) {
      toast({
        title: "You submitted the following values:",
        description: (
          <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
            <code className="text-white">
              {JSON.stringify(newOperation, null, 2)}
            </code>
          </pre>
        ),
      });

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

      // Doing some ui actions
      toast({
        title: "No se pudo cargar la entidad",
        description: `${JSON.stringify(err.data)}`,
        variant: "destructive",
      });
    },
    onSettled() {
      void utils.entities.getAll.invalidate();
    },
  });

  return (
    <div className="mx-auto flex w-2/3 flex-row space-x-4">
      <Button
        variant="outline"
        className="border-transparent p-1"
        onClick={() => deleteAsync({ entityId: entity.id })}
      >
        <Icons.cross className="h-6 text-red" />
      </Button>

      <ChangeEntityForm entity={entity} />
    </div>
  );
};

export default EntityOptions;
