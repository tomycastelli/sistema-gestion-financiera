"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import moment from "moment";
import { useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Icons } from "~/app/components/ui/Icons";
import { Button } from "~/app/components/ui/button";
import { Calendar } from "~/app/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/app/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/app/components/ui/form";
import { Input } from "~/app/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/components/ui/popover";
import { Textarea } from "~/app/components/ui/textarea";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterInputs } from "~/trpc/shared";

interface UpdateOperationProps {
  opId: number;
  opDate: Date;
  opObservations: string | undefined | null;
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  accountingPeriodDate: Date;
}

const FormSchema = z.object({
  opObservations: z.string().optional(),
  opDate: z.date(),
  opTime: z.string(),
});

const UpdateOperation: FC<UpdateOperationProps> = ({
  opId,
  opDate,
  opObservations,
  operationsQueryInput,
  accountingPeriodDate,
}) => {
  const utils = api.useContext();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      opObservations: opObservations ?? undefined,
      opDate,
      opTime: moment(opDate).format("HH:mm"),
    },
  });

  const { mutateAsync } = api.editingOperations.changeOpData.useMutation({
    async onMutate(newOperation) {
      await utils.operations.getOperations.cancel();

      const prevData =
        utils.operations.getOperations.getData(operationsQueryInput);

      utils.operations.getOperations.setData(operationsQueryInput, (old) => ({
        ...old!,
        operations: old!.operations.map((operation) => {
          if (operation.id === newOperation.opId) {
            return {
              ...operation,
              observations: newOperation.opObservations ?? null,
              date: newOperation.opDate,
            };
          } else {
            return operation;
          }
        }),
      }));

      return { prevData };
    },
    onError(err) {
      const prevData =
        utils.operations.getOperations.getData(operationsQueryInput);
      // Doing some ui actions
      toast.error("No se pudieron actualizar las transacciones", {
        description: err.message,
      });
      return { prevData };
    },
    onSettled() {
      void utils.operations.getOperations.invalidate();
      void utils.movements.getMovementsByOpId.invalidate();
      void utils.movements.getCurrentAccounts.invalidate();
      void utils.movements.getBalancesByEntities.invalidate();
      void utils.movements.getBalancesByEntitiesForCard.invalidate();
    },
    onSuccess(data) {
      setIsOpen(false);
      toast.success(`Operación ${data?.id} editada`);
    },
  });

  const { handleSubmit, reset } = form;

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    const dateString = moment(values.opDate).format("DD-MM-YYYY");
    await mutateAsync({
      opId,
      opObservations: values.opObservations,
      opDate: moment(dateString + values.opTime, "DD-MM-YYYY HH:mm").toDate(),
      oldOpDate: opDate,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => reset()}>
      <DialogTrigger asChild>
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="flex items-center justify-center border-transparent p-2"
        >
          <Icons.editing className="h-6 text-black dark:text-white" />
        </Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={() => setIsOpen(false)}
        className="sm:max-w-[500px]"
      >
        <DialogHeader>
          <div className="flex w-full flex-row justify-between">
            <div className="flex flex-col gap-y-1">
              <DialogTitle>Operación {opId}</DialogTitle>
              <DialogDescription>
                {moment(opDate).format("DD-MM-YYYY HH:mm")}
              </DialogDescription>
            </div>
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
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col justify-start space-y-2"
            >
              <FormField
                control={form.control}
                name="opObservations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea className="w-full resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-row items-end space-x-2">
                <FormField
                  control={form.control}
                  defaultValue={new Date()}
                  name="opDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="mb-1">Fecha</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[120px] bg-transparent pl-3 text-left font-normal hover:bg-transparent",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                moment(field.value).format("DD-MM-YYYY")
                              ) : (
                                <span>Elegir</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < accountingPeriodDate ||
                              date > moment().startOf("day").toDate()
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="opTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiempo</FormLabel>
                      <FormControl>
                        <Input className="w-[88px]" type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex w-full items-center justify-end">
                <Button className="mt-4" type="submit">
                  Modificar operación
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateOperation;
