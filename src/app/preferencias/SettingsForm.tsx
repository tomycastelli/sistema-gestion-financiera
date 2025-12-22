"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import moment from "moment";
import { type FC } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getAccountingPeriodDate } from "~/lib/functions";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { Button } from "../components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";

const FormSchema = z.object({
  months: z.string().min(1),
  graceDays: z.string().refine((str) => parseInt(str) >= 0),
});

interface SettingsFormProps {
  initialSettings: RouterOutputs["globalSettings"]["getAll"];
  isAdmin: boolean;
}

const SettingsForm: FC<SettingsFormProps> = ({ initialSettings, isAdmin }) => {
  const utils = api.useContext();

  const { data: settings } = api.globalSettings.getAll.useQuery(undefined, {
    initialData: initialSettings,
    refetchOnWindowFocus: false,
  });

  const { mutateAsync } = api.globalSettings.set.useMutation({
    async onMutate(newOperation) {
      // Doing the Optimistic update
      await utils.globalSettings.getAll.cancel();

      const prevData = utils.globalSettings.getAll.getData();

      utils.globalSettings.getAll.setData(
        undefined,
        (old) =>
          old?.map((obj) => {
            if (
              newOperation.name === "accountingPeriod" &&
              obj.name === "accountingPeriod"
            ) {
              return { name: "accountingPeriod", data: newOperation.data };
            }
            if (
              newOperation.name === "blockOperators" &&
              obj.name === "blockOperators"
            ) {
              return { name: "blockOperators", data: newOperation.data };
            }
            return obj;
          }),
      );

      return { prevData };
    },
    onError(err, _, ctx) {
      utils.globalSettings.getAll.setData(undefined, ctx?.prevData);

      toast.error("No se pudo actualizar la configuración", {
        description: err.message,
      });
    },
    onSettled() {
      void utils.globalSettings.getAll.invalidate();
    },
    onSuccess() {
      toast.success("Configuración modificada");
    },
  });

  const accountingPeriod = settings.find(
    (obj) => obj.name === "accountingPeriod",
  ) as {
    name: string;
    data: { months: number; graceDays: number };
  };

  const blockOperators = settings.find(
    (obj) => obj.name === "blockOperators",
  ) as {
    name: string;
    data: { enabled: boolean };
  };

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      months: accountingPeriod.data.months.toString(),
      graceDays: accountingPeriod.data.graceDays.toString(),
    },
  });

  const { handleSubmit, control, watch } = form;

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    await mutateAsync({
      name: "accountingPeriod",
      data: {
        months: parseInt(values.months),
        graceDays: parseInt(values.graceDays),
      },
    });
  };

  const accountingPeriodDate = getAccountingPeriodDate(
    parseInt(watch("months")),
    parseInt(watch("graceDays")),
  );

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-1/3 flex-col justify-start gap-y-6"
      >
        <div className="flex flex-col justify-start gap-y-4">
          <h1 className="text-xl">Período contable</h1>
          <FormField
            control={control}
            name="months"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meses</FormLabel>
                <FormControl>
                  <Input disabled={!isAdmin} type="number" {...field} />
                </FormControl>
                <FormDescription>
                  Duración del periodo contable. Pasado el periodo de una
                  operación, la misma no podrá ser modificada.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="graceDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Días de gracia</FormLabel>
                <FormControl>
                  <Input disabled={!isAdmin} type="number" min={0} {...field} />
                </FormControl>
                <FormDescription>
                  Cuantos días, pasado el mes, puede una operación ser
                  modificada.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-col justify-start gap-y-1 text-sm">
            <p>
              Inicio del periodo actual:{" "}
              <span className="font-semibold">
                {moment(accountingPeriodDate).format("DD-MM-YYYY")}
              </span>
            </p>
            <p>
              Las operaciones y los balances previos a esta fecha no podrán ser
              modificados.
            </p>
          </div>
        </div>
        <Button type="submit" disabled={!isAdmin}>
          Guardar
        </Button>
      </form>
      <div className="mt-8 flex w-1/3 flex-col justify-start gap-y-4">
        <h1 className="text-xl">Bloquear operadores</h1>
        <div className="flex flex-row items-center gap-x-4">
          <Switch
            checked={blockOperators.data.enabled}
            onCheckedChange={async (checked) => {
              if (!isAdmin) return;
              await mutateAsync({
                name: "blockOperators",
                data: { enabled: checked },
              });
            }}
            disabled={!isAdmin}
          />
          <div className="flex flex-col">
            <p className="text-sm font-medium">
              {blockOperators.data.enabled ? "Bloqueado" : "No bloqueado"}
            </p>
            <p className="text-sm text-muted-foreground">
              Cuando está activado, no se pueden crear transacciones con
              entidades cuyo tag es "Operadores" en las posiciones de origen o
              destino.
            </p>
          </div>
        </div>
      </div>
    </Form>
  );
};

export default SettingsForm;
