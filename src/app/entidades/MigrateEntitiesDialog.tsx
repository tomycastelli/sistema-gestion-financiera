"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "lucia";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import EntityCard from "~/app/components/ui/EntityCard";
import { Icons } from "~/app/components/ui/Icons";
import { Button } from "~/app/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/app/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/app/components/ui/form";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import CustomSelector from "../components/forms/CustomSelector";

interface MigrateEntitiesDialogProps {
  originEntity: RouterOutputs["entities"]["getAll"][number];
  entities: RouterOutputs["entities"]["getAll"];
  user: User;
}

const FormSchema = z.object({
  destionationEntityId: z.string(),
});

const MigrateEntitiesDialog = ({
  originEntity,
  entities,
  user,
}: MigrateEntitiesDialogProps) => {
  const utils = api.useContext();
  const [isOpen, setIsOpen] = useState(false);

  const someEntitiesPermission = user.permissions?.find(
    (p) => p.name === "ENTITIES_MANAGE_SOME",
  );
  const filteredEntities = user.permissions?.some(
    (p) => p.name === "ADMIN" || p.name === "ENTITIES_MANAGE",
  )
    ? entities
    : someEntitiesPermission
    ? entities.filter(
        (e) =>
          someEntitiesPermission.entitiesIds?.includes(e.id) ||
          someEntitiesPermission.entitiesTags?.includes(e.tag.name),
      )
    : [];

  const { mutateAsync: migrateAsync } =
    api.editingOperations.migrateEntities.useMutation({
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate();
        void utils.movements.getCurrentAccounts.invalidate();
      },
    });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const { handleSubmit, control, watch, reset } = form;

  const onSubmit = (values: z.infer<typeof FormSchema>) => {
    const numberDestinationEntityId = Number(values.destionationEntityId);
    const promise = migrateAsync({
      originEntityId: originEntity.id,
      originEntityTag: originEntity.tag.name,
      destinationEntityId: numberDestinationEntityId,
      destinationEntityTag: entities.find(
        (e) => e.id === numberDestinationEntityId,
      )!.tag.name,
    });

    setIsOpen(false);

    toast.promise(promise, {
      loading: "Migrando transacciones...",
      success(data) {
        return `${data.transactionCount} ${
          data.transactionCount !== 1 ? "transacciones" : "transacción"
        } actualizada${data.transactionCount !== 1 ? "s" : ""}`;
      },
    });
  };

  const watchDestionationEntityId = watch("destionationEntityId");

  return (
    <Dialog open={isOpen} onOpenChange={() => reset()}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          type="button"
          disabled={!filteredEntities.some((e) => e.id === originEntity.id)}
          onClick={() => setIsOpen(true)}
          className="border-transparent p-1"
        >
          <Icons.translate className="h-6 text-black dark:text-white" />
        </Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={() => setIsOpen(false)}
        className="sm:max-w-[1000px]"
      >
        <DialogHeader>
          <div className="flex w-full flex-row justify-between">
            <DialogTitle>
              Migrar {originEntity.name}{" "}
              {watchDestionationEntityId
                ? `a ${entities.find(
                    (e) => e.id === Number(watchDestionationEntityId),
                  )?.name}`
                : ""}
            </DialogTitle>
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsOpen(false)}
              >
                Cerrar
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div>
          <Form {...form}>
            <form
              onSubmit={(e) => {
                e.stopPropagation();
                void handleSubmit(onSubmit)(e);
              }}
              className="flex flex-col space-y-2"
            >
              <div className="grid grid-cols-3 place-items-center">
                <EntityCard
                  entity={originEntity}
                  disableLinks={true}
                  className="justify-self-end"
                />
                <Icons.arrowRight className="h-10 w-10 justify-self-center text-white" />
                <FormField
                  control={control}
                  name="destionationEntityId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col justify-self-start">
                      <FormLabel>Entidad Destino</FormLabel>
                      {filteredEntities && (
                        <>
                          <CustomSelector
                            data={filteredEntities.map((entity) => ({
                              value: entity.id.toString(),
                              label: entity.name,
                            }))}
                            field={field}
                            fieldName="destionationEntityId"
                            placeholder="Elegir"
                          />
                          {watchDestionationEntityId && (
                            <EntityCard
                              entity={
                                entities.find(
                                  (e) =>
                                    e.id.toString() ===
                                    watchDestionationEntityId,
                                )!
                              }
                              disableLinks={true}
                            />
                          )}
                        </>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex w-full items-center justify-end space-x-8">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => reset()}
                  className="mt-4 flex flex-row items-center justify-center space-x-2 p-2"
                >
                  Resetear <Icons.undo className="ml-2 h-8" />
                </Button>
                <Button className="mt-4" type="submit">
                  Migrar transacciones
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MigrateEntitiesDialog;
