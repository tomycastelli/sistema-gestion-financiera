"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import type { User } from "next-auth";
import { useState } from "react";
import { capitalizeFirstLetter, getAllChildrenTags } from "~/lib/functions";
import { useInitialOperationStore } from "~/stores/InitialOperationStore";
import { useTransactionsStore } from "~/stores/TransactionsStore";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import UploadedUserOperations from "../UploadedUserOperations";
import AlertTemplate from "../ui/AlertTemplate";
import { Icons } from "../ui/Icons";
import { Badge } from "../ui/badge";
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
import CableForm from "./CableForm";
import CambioForm from "./CambioForm";
import FlexibleTransactionsForm from "./FlexibleTransactionsForm";
import InitialDataOperationForm from "./InitialDataOperationForm";

interface AddOperationProps {
  initialEntities: RouterOutputs["entities"]["getAll"];
  user: User;
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  initialOperations:
    | RouterOutputs["operations"]["getOperationsByUser"]
    | undefined;
  tags: RouterOutputs["tags"]["getAll"];
}

const AddOperation = ({
  initialEntities,
  user,
  initialOperations,
  userPermissions,
  tags,
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
      refetchOnWindowFocus: false,
    });

  const { mutateAsync, isLoading } = api.operations.insertOperation.useMutation(
    {
      async onMutate(newOperation) {
        const transaccionesCargadas = newOperation.transactions.length;
        toast({
          title: `Operacion y ${
            transaccionesCargadas > 1
              ? transaccionesCargadas.toString() + " transacciones cargadas"
              : transaccionesCargadas + " transaccion cargada"
          }`,
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
    },
  );
  const [hours, minutes] = initialOperationStore.opTime.split(":").map(Number);
  let selectedDate = initialOperationStore.opDate;

  if (hours !== undefined && minutes !== undefined) {
    selectedDate = new Date(
      initialOperationStore.opDate.setHours(hours, minutes),
    );
  }

  const uploadOperation = async () => {
    try {
      await mutateAsync({
        opDate: selectedDate,
        opObservations: initialOperationStore.opObservations,
        transactions: transactionsStore.map((transaction) => ({
          type: transaction.type,
          operatorEntityId: transaction.operatorId,
          fromEntityId: transaction.fromEntityId,
          toEntityId: transaction.toEntityId,
          currency: transaction.currency,
          amount: transaction.amount,
          method: transaction.method,
          metadata: transaction.metadata,
        })),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const { isLoading: isEntitiesLoading, data: allEntities } =
    api.entities.getAll.useQuery(undefined, {
      initialData: initialEntities,
      refetchOnMount: false,
      refetchOnReconnect: false,
    });

  const filteredEntities = allEntities.filter((entity) => {
    if (
      userPermissions?.find(
        (p) => p.name === "ADMIN" || p.name === "OPERATIONS_CREATE",
      )
    ) {
      return true;
    } else if (
      userPermissions?.find(
        (p) =>
          p.name === "OPERATIONS_CREATE_SOME" &&
          (p.entitiesIds?.includes(entity.id) ||
            getAllChildrenTags(p.entitiesTags, tags).includes(
              entity.tag.name,
            ) ||
            entity.name === user.name),
      )
    ) {
      return true;
    }
  });

  const tabs = ["flexible", "cambio", "cable"];

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
                              filteredEntities.find(
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
                              {transaction.method &&
                                capitalizeFirstLetter(transaction.method)}
                            </p>
                          </div>
                          <p>
                            {
                              filteredEntities.find(
                                (obj) => obj.id === transaction.toEntityId,
                              )?.name
                            }
                          </p>
                        </div>

                        <Badge
                          variant="outline"
                          className="mr-auto flex justify-center"
                        >
                          {capitalizeFirstLetter(transaction.type)}
                        </Badge>
                        <div className="flex flex-row justify-between">
                          <p className="font-medium">
                            {
                              filteredEntities.find(
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
                    {transactionsStore.length > 0 && (
                      <Button
                        className="w-full"
                        onClick={() => uploadOperation()}
                      >
                        <Icons.addPackage className="mr-2 h-4 w-4" />
                        {isLoading ? (
                          <p>Cargando...</p>
                        ) : (
                          <p>Cargar operación</p>
                        )}
                      </Button>
                    )}
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
          filteredEntities &&
          user && (
            <div>
              <Tabs value={tabName} className="w-full">
                <TabsList className="mb-8 grid w-full auto-cols-fr grid-flow-col gap-2 bg-transparent">
                  {tabs.map((tab) => (
                    <AlertTemplate
                      key={tab}
                      buttonText={capitalizeFirstLetter(tab)}
                      buttonStyling={
                        tabName === tab
                          ? "bg-primary text-white"
                          : "bg-muted text-foreground"
                      }
                      alertTitle={`¿Seguro que querés cambiar a ${tab}?`}
                      alertAccept="Confirmar"
                      alertCancel="Cancelar"
                      alertDescription="Se perderán los datos cargados no subidos a la operación"
                      alertFunction={() => setTabName(tab)}
                    />
                  ))}
                </TabsList>
                <TabsContent
                  value="flexible"
                  className="mx-auto flex flex-col items-center"
                >
                  <FlexibleTransactionsForm
                    isLoading={isEntitiesLoading}
                    entities={filteredEntities}
                    user={user}
                  />
                </TabsContent>
                <TabsContent value="cambio">
                  <CambioForm
                    entities={filteredEntities}
                    user={user}
                    isLoading={isEntitiesLoading}
                  />
                </TabsContent>
                <TabsContent value="cable">
                  <CableForm
                    entities={filteredEntities}
                    userEntityId={
                      allEntities
                        .find((entity) => entity.name === user.name)!
                        .id.toString()
                        ? allEntities
                            .find((entity) => entity.name === user.name)!
                            .id.toString()
                        : ""
                    }
                  />
                </TabsContent>
              </Tabs>
            </div>
          )
        ) : (
          <InitialDataOperationForm />
        )}
      </div>
      <div className="lg:col-span-1">
        <UploadedUserOperations
          operations={operations}
          ref={parent}
          isLoading={isOperationsLoading}
        />
      </div>
    </div>
  );
};

export default AddOperation;
