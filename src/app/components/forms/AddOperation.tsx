"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import type { Entities } from "@prisma/client";
import moment from "moment-timezone";
import type { User } from "next-auth";
import { useState } from "react";
import { capitalizeFirstLetter } from "~/lib/functions";
import { useInitialOperationStore } from "~/stores/InitialOperationStore";
import { useTransactionsStore } from "~/stores/TransactionsStore";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import UploadedUserOperations from "../UploadedUserOperations";
import AlertTemplate from "../ui/AlertTemplate";
import { Icons } from "../ui/Icons";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList } from "../ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useToast } from "../ui/use-toast";
import CambioForm from "./CambioForm";
import FlexibleTransactionsForm from "./FlexibleTransactionsForm";
import InitialDataOperationForm from "./InitialDataOperationForm";

interface AddOperationProps {
  entities: Entities[] | undefined;
  user: User;
  initialOperations:
    | RouterOutputs["operations"]["getOperationsByUser"]
    | undefined;
}

const AddOperation = ({
  entities,
  user,
  initialOperations,
}: AddOperationProps) => {
  const { toast } = useToast();
  const [parent] = useAutoAnimate();
  const [tabName, setTabName] = useState("flexible");

  const utils = api.useContext();

  const {
    isInitialOperationSubmitted,
    initialOperationStore,
    resetInitialOperationStore,
    setIsInitialOperationSubmitted,
  } = useInitialOperationStore();
  const {
    transactionsStore,
    removeTransactionFromStore,
    resetTransactionsStore,
  } = useTransactionsStore();

  const { data: operations, isLoading: isOperationsLoading } =
    api.operations.getOperationsByUser.useQuery(undefined, {
      initialData: initialOperations,
      refetchOnMount: false,
      refetchOnReconnect: false,
    });

  const { mutateAsync, isLoading, isSuccess } =
    api.operations.insertOperation.useMutation({
      async onMutate(newOperation) {
        // Doing some ui actions
        const transaccionesCargadas = newOperation.transactions.length;

        toast({
          title: `Operacion y ${
            transaccionesCargadas > 1
              ? transaccionesCargadas.toString() + " transacciones cargadas"
              : transaccionesCargadas + " transaccion cargada"
          }`,
          variant: "success",
        });

        setIsInitialOperationSubmitted(false);
        resetTransactionsStore();
        resetInitialOperationStore();

        // Doing the Optimistic update
        await utils.operations.getOperationsByUser.cancel();

        const prevData = utils.operations.getOperationsByUser.getData();

        const predictedId = operations?.[0]?.id ? operations[0].id + 1 : 1;

        const fakeNewData: RouterOutputs["operations"]["getOperationsByUser"][number] =
          {
            id: predictedId,
            date: newOperation.opDate,
            observations: newOperation.opObservations
              ? newOperation.opObservations
              : "",
            status: false,
            _count: { transactions: newOperation.transactions.length },
          };

        utils.operations.getOperationsByUser.setData(undefined, (old) => [
          fakeNewData,
          // @ts-ignore
          ...old,
        ]);

        return { prevData };
      },
      onError(err, newOperation, ctx) {
        utils.operations.getOperationsByUser.setData(undefined, ctx?.prevData);

        // Doing some ui actions
        toast({
          title:
            "No se pudo cargar la operación y las transacciones relacionadas",
          description: `${JSON.stringify(err.data)}`,
          variant: "destructive",
        });
      },
      onSettled() {
        void utils.operations.getOperationsByUser.invalidate();
      },
    });

  const uploadOperation = async () => {
    try {
      const response = await mutateAsync({
        opDate: moment(initialOperationStore.opDate).toDate(),
        opObservations: initialOperationStore.opObservations,
        transactions: transactionsStore.map((transaction) => ({
          type: transaction.type,
          operatorEntityId: transaction.operatorId,
          fromEntityId: transaction.fromEntityId,
          toEntityId: transaction.toEntityId,
          currency: transaction.currency,
          amount: transaction.amount,
          method: transaction.method,
        })),
      });

      console.log(response);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-4 grid grid-cols-1 gap-8 lg:mx-auto lg:grid-cols-4">
      <div className="lg:col-span-1">
        <Card>
          {isInitialOperationSubmitted ? (
            <>
              <CardHeader>
                <div className="flex flex-row justify-between">
                  <CardTitle>
                    {initialOperationStore.opDate.toLocaleDateString("es-AR")}{" "}
                    <span className="ml-2 text-muted-foreground">
                      {initialOperationStore.opTime}
                    </span>
                  </CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="bg-primary"
                          onClick={() => setIsInitialOperationSubmitted(false)}
                        >
                          <Icons.undo className="h-6" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Volver</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardTitle>
                  <span className="mr-2 text-primary">
                    {transactionsStore.length}
                  </span>
                  transacciones
                </CardTitle>
                {initialOperationStore.opObservations && (
                  <h1 className="text-sm text-muted-foreground">
                    {initialOperationStore.opObservations}
                  </h1>
                )}
              </CardHeader>
              {transactionsStore && (
                <>
                  <CardContent className="flex flex-col space-y-4" ref={parent}>
                    {transactionsStore.map((transaction) => (
                      <div
                        key={transaction.txId}
                        className="flex flex-col space-y-1"
                      >
                        <h1 className="text-sm text-muted-foreground">
                          id {transaction.txId}
                        </h1>
                        <div className="grid grid-cols-3 items-center">
                          <h2>
                            {
                              entities?.find(
                                (obj) => obj.id === transaction.fromEntityId,
                              )?.name
                            }
                          </h2>
                          <div className="flex flex-col items-center">
                            <Icons.arrowRight className="h-6" />
                            <p className="font-semibold">
                              {transaction.amount}
                            </p>
                            <p className="font-medium leading-none text-muted-foreground">
                              {transaction.currency.toUpperCase()}
                            </p>
                            <p className="mt-1 font-medium leading-none text-muted-foreground">
                              {transaction.method}
                            </p>
                          </div>
                          <p>
                            {
                              entities?.find(
                                (obj) => obj.id === transaction.toEntityId,
                              )?.name
                            }
                          </p>
                        </div>
                        <p className="text-green">
                          {capitalizeFirstLetter(transaction.type)}
                        </p>
                        <div className="flex flex-row justify-between">
                          <p className="font-medium">
                            {
                              entities?.find(
                                (obj) => obj.id === transaction.operatorId,
                              )?.name
                            }
                          </p>
                          <Button
                            onClick={() =>
                              removeTransactionFromStore(transaction.txId)
                            }
                            className="bg-transparent p-1 hover:scale-125 hover:bg-transparent"
                          >
                            <Icons.removePackage className="h-6 text-red" />
                          </Button>
                        </div>
                        <Separator className="mt-1" />
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => uploadOperation()}
                    >
                      <Icons.addPackage className="mr-2 h-4 w-4" />
                      {isLoading ? <p>Cargando...</p> : <p>Cargar operación</p>}
                    </Button>
                  </CardFooter>
                </>
              )}
            </>
          ) : (
            <p>Seleccioná una fecha para empezar la operación</p>
          )}
        </Card>
      </div>
      <div className="lg:col-span-2">
        {isInitialOperationSubmitted ? (
          entities &&
          user && (
            <div>
              <Tabs value={tabName} className="w-full">
                <TabsList className="mb-8 grid w-full grid-cols-2 gap-2 bg-transparent">
                  <AlertTemplate
                    buttonText="Flexible"
                    buttonStyling={
                      tabName === "flexible"
                        ? "bg-white text-foreground"
                        : "bg-muted text-foreground"
                    }
                    alertTitle="Seguro que queres cambiar a flexible?"
                    alertAccept="Confirmar"
                    alertCancel="Cancelar"
                    alertDescription="Se perderan los datos cargados no subidos a la operación"
                    alertFunction={() => setTabName("flexible")}
                  />
                  <AlertTemplate
                    buttonText="Cambio"
                    buttonStyling={
                      tabName === "cambio"
                        ? "bg-white text-foreground"
                        : "bg-muted text-foreground"
                    }
                    alertTitle="Seguro que queres cambiar a cambio?"
                    alertAccept="Confirmar"
                    alertCancel="Cancelar"
                    alertDescription="Se perderan los datos cargados no subidos a la operación"
                    alertFunction={() => setTabName("cambio")}
                  />
                </TabsList>
                <TabsContent
                  value="flexible"
                  className="mx-auto flex flex-col items-center"
                >
                  <FlexibleTransactionsForm
                    initialEntities={entities}
                    user={user}
                  />
                </TabsContent>
                <TabsContent value="cambio">
                  <CambioForm initialEntities={entities} user={user} />
                </TabsContent>
              </Tabs>
            </div>
          )
        ) : (
          <InitialDataOperationForm />
        )}
      </div>
      <div className="lg:col-span-1">
        {user?.id ? (
          <>
            {isOperationsLoading ? (
              <p>Cargando...</p>
            ) : (
              <UploadedUserOperations
                operations={operations}
                ref={parent}
                isLoading={isSuccess}
              />
            )}
          </>
        ) : (
          <p>El usuario no esta logueado</p>
        )}
      </div>
    </div>
  );
};

export default AddOperation;
