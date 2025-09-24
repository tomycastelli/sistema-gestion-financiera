"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { type User } from "lucia";
import moment from "moment";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  capitalizeFirstLetter,
  findDuplicateObjects,
  numberFormatter,
} from "~/lib/functions";
import { currentAccountOnlyTypes, gastoCategories } from "~/lib/variables";
import { Status } from "~/server/db/schema";
import { useTransactionsStore } from "~/stores/TransactionsStore";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import CustomPagination from "../CustomPagination";
import UploadedUserOperations from "../UploadedUserOperations";
import AlertTemplate from "../ui/AlertTemplate";
import { Icons } from "../ui/Icons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import InitialDataOperationForm from "./InitialDataOperationForm";
const CambioForm = dynamic(() => import("./CambioForm"));
const CableForm = dynamic(() => import("./CableForm"));
const FlexibleTransactionsForm = dynamic(
  () => import("./FlexibleTransactionsForm"),
);

interface AddOperationProps {
  initialEntities: RouterOutputs["entities"]["getAll"];
  user: User;
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  initialOperations: RouterOutputs["operations"]["getOperations"];
  tags: RouterOutputs["tags"]["getAll"];
  accountingPeriodDate: Date;
  mainTags: string[];
  users: RouterOutputs["users"]["getAll"];
  main_name: string;
}

const AddOperation = ({
  initialEntities,
  user,
  initialOperations,
  accountingPeriodDate,
  mainTags,
  users,
  main_name,
}: AddOperationProps) => {
  const [parent] = useAutoAnimate();
  const [tabName, setTabName] = useState<string>("flexible");
  const [txsPage, setTxsPage] = useState<number>(1);

  const searchParams = useSearchParams();

  const selectedOpIdString = searchParams.get("operacion");
  const selectedOpId = selectedOpIdString ? parseInt(selectedOpIdString) : null;

  const utils = api.useContext();

  const {
    transactionsStore,
    removeTransactionFromStore,
    resetTransactionsStore,
    confirmationAtUpload,
    setConfirmationAtUpload,
    resetConfirmationAtUpload,
    removeConfirmationAtUpload,
    setAllConfirmationAtUpload,
    isInitialDataSubmitted,
    setIsInitialDataSubmitted,
    resetOperationData,
    opDate,
    observations,
    setObservations,
  } = useTransactionsStore();

  const { mutateAsync: updateStatus, isLoading: isUpdateStatusLoading } =
    api.editingOperations.updateTransactionStatus.useMutation();

  const { mutateAsync, isLoading } = api.operations.insertOperation.useMutation(
    {
      async onMutate() {
        // Doing the Optimistic update
        await utils.operations.getOperations.cancel();

        const prevData = utils.operations.getOperations.getData();

        return { prevData };
      },
      onSettled() {
        void utils.operations.getOperations.invalidate();
        void utils.movements.getCurrentAccounts.invalidate();
      },
      onSuccess() {
        setIsInitialDataSubmitted(false);
        resetTransactionsStore();
        resetOperationData();
        resetConfirmationAtUpload();
      },
    },
  );

  const { isLoading: isEntitiesLoading, data: entities } =
    api.entities.getAll.useQuery(undefined, {
      initialData: initialEntities,
      refetchOnWindowFocus: false,
    });

  // Create entities map for faster lookups
  const entitiesMap =
    entities
      .filter((entity) => entity.enabled)
      .reduce(
        (acc, entity) => {
          acc[entity.id] = entity;
          return acc;
        },
        {} as Record<number, (typeof entities)[0]>,
      ) ?? {};

  const tabs = ["flexible", "cambio", "cable"];

  const transactionInfo = [
    {
      title: "Cambio",
      description:
        "La transacción generá un movimiento en Cuenta Corriente con dirección contraria. Al confirmar, se anula la Cuenta Corriente y se generará un movimiento en Caja con la misma dirección.",
    },
    {
      title: "Cable, Fee, Cuenta corriente",
      description:
        "La transacción generará un movimiento en Cuenta Corriente con la misma dirección.",
    },
    {
      title: "Ingreso, Gasto",
      description:
        "La transacción generará un movimiento en Caja con la misma dirección",
    },
    {
      title: "Pago por cuenta corriente",
      description:
        "La transacción generará dos movimientos con la misma dirección, uno en Cuenta Corriente y otro en Caja",
    },
  ];

  const dateToRender =
    opDate.date === "now"
      ? "Ahora"
      : moment(opDate.data.opDate).format("DD-MM-YYYY");
  const timeToRender =
    opDate.date === "now"
      ? "La fecha sera el momento de carga"
      : opDate.data.opTime;

  return (
    <div className="mx-4 grid grid-cols-1 gap-8 lg:mx-auto lg:grid-cols-4">
      <div className="lg:col-span-1">
        <Card>
          {isInitialDataSubmitted || selectedOpId ? (
            <>
              <CardHeader>
                <div className="flex flex-row justify-between">
                  <div className="flex flex-col">
                    <CardTitle>{dateToRender}</CardTitle>
                    <CardDescription className="text-1xl mt-1 font-semibold text-muted-foreground">
                      {timeToRender}
                    </CardDescription>
                  </div>
                  <Button
                    tooltip="Volver"
                    variant="outline"
                    onClick={() => setIsInitialDataSubmitted(false)}
                  >
                    <Icons.undo className="h-6" />
                  </Button>
                </div>
                <CardTitle>
                  <span className="mr-2 text-primary">
                    {transactionsStore.length}
                  </span>
                  {transactionsStore.length === 1
                    ? "transacción"
                    : "transacciones"}
                </CardTitle>
              </CardHeader>
              {transactionsStore && (
                <>
                  <CardContent className="flex flex-col space-y-4" ref={parent}>
                    {transactionsStore
                      .slice((txsPage - 1) * 2, txsPage * 2)
                      .map((transaction, index) => (
                        <div
                          key={transaction.txId}
                          className="flex flex-col space-y-4"
                        >
                          <h1 className="text-sm text-muted-foreground">
                            Tx {transaction.txId}
                          </h1>
                          <div className="grid grid-cols-3 items-center">
                            <Badge
                              className="justify-self-center"
                              variant="outline"
                            >
                              {entitiesMap[transaction.fromEntityId]?.name}
                            </Badge>
                            <div className="flex flex-col items-center justify-self-center">
                              <Icons.arrowRight className="h-6" />
                              <p className="font-semibold">
                                {numberFormatter(transaction.amount)}
                              </p>
                              <p className="font-medium leading-none text-muted-foreground">
                                {transaction.currency.toUpperCase()}
                              </p>
                            </div>
                            <Badge
                              className="justify-self-center"
                              variant="outline"
                            >
                              {entitiesMap[transaction.toEntityId]?.name}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-y-2">
                            <Badge
                              variant="outline"
                              className="mr-auto flex justify-center"
                            >
                              {capitalizeFirstLetter(transaction.type)}
                            </Badge>
                            {transaction.category && (
                              <Badge
                                variant="outline"
                                className="mr-auto flex justify-center"
                              >
                                {gastoCategories
                                  .flatMap((category) => category.subCategories)
                                  .find(
                                    (subcategory) =>
                                      subcategory.value ===
                                      transaction.subCategory,
                                  )?.label ?? transaction.subCategory}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-row justify-between">
                            <div className="flex flex-col justify-start space-y-1">
                              <p className="text-sm font-medium">Operador</p>
                              <Badge variant="outline">
                                {entitiesMap[transaction.operatorId]?.name}
                              </Badge>
                            </div>

                            <Button
                              onClick={() => {
                                removeTransactionFromStore(transaction.txId);
                                removeConfirmationAtUpload(index);
                              }}
                              className="bg-transparent p-1 hover:scale-125 hover:bg-transparent"
                            >
                              <Icons.removePackage className="h-6 text-red" />
                            </Button>
                          </div>
                          {transaction.type === "cambio" && (
                            <div className="flex flex-row items-center justify-center gap-x-2">
                              <Switch
                                checked={confirmationAtUpload.includes(
                                  transaction.txId,
                                )}
                                onCheckedChange={() =>
                                  setConfirmationAtUpload(transaction.txId)
                                }
                              />
                              <p className="text-sm font-light text-muted-foreground">
                                Confirmar
                              </p>
                            </div>
                          )}
                          <Separator className="mt-1" />
                        </div>
                      ))}
                    {transactionsStore.length > 2 && (
                      <CustomPagination
                        page={txsPage}
                        pageSize={2}
                        itemName="transacciones"
                        totalCount={transactionsStore.length}
                        changePageState={setTxsPage}
                      />
                    )}
                    <Textarea
                      className="h-16 w-full resize-none"
                      placeholder="Observaciones..."
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                    />
                  </CardContent>
                  <CardFooter className="flex flex-col items-center space-y-2">
                    {transactionsStore.filter((tx) => tx.type === "cambio")
                      .length > 0 && (
                      <div className="flex flex-row items-center justify-center gap-x-2">
                        <Label className="text-sm font-light text-muted-foreground">
                          Confirmar todos
                        </Label>
                        <Switch
                          disabled={isUpdateStatusLoading}
                          onCheckedChange={(bool) =>
                            setAllConfirmationAtUpload(bool)
                          }
                        ></Switch>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      disabled={transactionsStore.length === 0 || isLoading}
                      onClick={() => {
                        const transactionsMapped = transactionsStore.map(
                          (transaction) => ({
                            formId: transaction.txId,
                            type: transaction.type,
                            operatorEntityId: transaction.operatorId,
                            fromEntityId: transaction.fromEntityId,
                            toEntityId: transaction.toEntityId,
                            currency: transaction.currency,
                            amount: transaction.amount,
                            category: transaction.category,
                            subCategory: transaction.subCategory,
                            metadata: transaction.metadata,
                            relatedTransactionId: transaction.relatedTxId,
                          }),
                        );
                        const duplicates = findDuplicateObjects(
                          transactionsMapped,
                          [
                            "amount",
                            "currency",
                            "fromEntityId",
                            "toEntityId",
                            "operatorEntityId",
                            "type",
                          ],
                        );
                        if (duplicates.length > 0) {
                          toast(
                            ["Hay transacciones repetidas en el carrito:"]
                              .concat(
                                duplicates.map(
                                  (tx) =>
                                    `${entitiesMap[tx.fromEntityId]
                                      ?.name} -> ${entitiesMap[tx.toEntityId]
                                      ?.name} - ${tx.amount} ${tx.currency} - ${
                                      tx.type
                                    }`,
                                ),
                              )
                              .join("\n"),
                            {
                              description:
                                "¿Querés confirmar las transacciones repetidas?",
                              duration: 15000,
                              closeButton: true,
                              action: {
                                label: "Confirmar",
                                onClick: () => {
                                  const promise = (async () => {
                                    const response = await mutateAsync({
                                      opDate:
                                        opDate.date === "now"
                                          ? new Date()
                                          : moment(
                                              moment(opDate.data.opDate).format(
                                                "DD-MM-YYYY",
                                              ) + opDate.data.opTime,
                                              "DD-MM-YYYY HH:mm",
                                            ).toDate(),
                                      opObservations: observations,
                                      opId: selectedOpId,
                                      transactions: transactionsMapped,
                                      confirmRepeatedTransactions: true,
                                    });

                                    if (confirmationAtUpload.length > 0) {
                                      await updateStatus({
                                        transactionIds: response.transactions
                                          .filter(
                                            (tx) =>
                                              tx.status ===
                                                Status.enumValues[2] &&
                                              !currentAccountOnlyTypes.has(
                                                tx.type,
                                              ) &&
                                              confirmationAtUpload.includes(
                                                tx.formId,
                                              ),
                                          )
                                          .map((tx) => tx.id),
                                      });
                                    }
                                    return response;
                                  })();

                                  toast.promise(promise, {
                                    loading: "Cargando operación...",
                                    success: (data) => {
                                      const transaccionesCargadas =
                                        data.transactions.length;
                                      return transaccionesCargadas > 1
                                        ? `${transaccionesCargadas} transacciones cargadas a la operación ${data.operation?.id}`
                                        : `${transaccionesCargadas} transacción cargada a la operación ${data.operation?.id}`;
                                    },
                                    error: (error) =>
                                      `No se pudo cargar la operación y las transacciones relacionadas: ${error.message}`,
                                  });
                                },
                              },
                            },
                          );
                        } else {
                          const promise = (async () => {
                            const response = await mutateAsync({
                              opDate:
                                opDate.date === "now"
                                  ? new Date()
                                  : moment(
                                      moment(opDate.data.opDate).format(
                                        "DD-MM-YYYY",
                                      ) + opDate.data.opTime,
                                      "DD-MM-YYYY HH:mm",
                                    ).toDate(),
                              opObservations: observations,
                              opId: selectedOpId,
                              transactions: transactionsMapped,
                              confirmRepeatedTransactions: false,
                            });
                            if (confirmationAtUpload.length > 0) {
                              await updateStatus({
                                transactionIds: response.transactions
                                  .filter(
                                    (tx) =>
                                      tx.status === Status.enumValues[2] &&
                                      !currentAccountOnlyTypes.has(tx.type) &&
                                      confirmationAtUpload.includes(tx.formId),
                                  )
                                  .map((tx) => tx.id),
                              });
                            }
                            return response;
                          })();

                          toast.promise(promise, {
                            loading: "Cargando operación...",
                            success: (data) => {
                              const transaccionesCargadas =
                                data.transactions.length;
                              return transaccionesCargadas > 1
                                ? `${transaccionesCargadas} transacciones cargadas a la operación ${data.operation?.id}`
                                : `${transaccionesCargadas} transacción cargada a la operación ${data.operation?.id}`;
                            },
                            error: (error) =>
                              `No se pudo cargar la operación y las transacciones relacionadas: ${error.message}`,
                          });
                        }
                      }}
                    >
                      <Icons.addPackage className="mr-2 h-4 w-4" />
                      {isLoading ? (
                        <p>Cargando...</p>
                      ) : selectedOpId ? (
                        <p>Cargar a la operación {selectedOpId} </p>
                      ) : (
                        <p>Cargar operación</p>
                      )}
                    </Button>
                    {transactionsStore.length < 1 && (
                      <p className="text-sm">
                        Añadí una transacción para continuar{" "}
                      </p>
                    )}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex flex-row items-center justify-center gap-x-2"
                        >
                          <Icons.info className="h-5" />
                          <p>Tipos de transacción</p>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" className="h-80 w-52">
                        <ScrollArea className="flex h-full w-full flex-col justify-start">
                          {transactionInfo.map((info) => (
                            <div
                              key={info.title}
                              className="mb-2 flex flex-col justify-start"
                            >
                              <p className="text-md font-semibold">
                                {info.title}
                              </p>
                              <p className="text-md text-start font-light">
                                {info.description}
                              </p>
                            </div>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </CardFooter>
                </>
              )}
            </>
          ) : (
            <p className="p-2 text-lg font-semibold">
              Seleccioná una fecha para empezar la operación
            </p>
          )}
        </Card>
      </div>
      <div className="lg:col-span-2">
        {isInitialDataSubmitted || selectedOpId ? (
          entities &&
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
                      alertDescription="Se perderán los datos no cargados a la operación"
                      alertFunction={() => setTabName(tab)}
                    />
                  ))}
                </TabsList>
                <TabsContent
                  value="flexible"
                  className="mx-auto flex flex-col items-center"
                >
                  <FlexibleTransactionsForm
                    mainTags={mainTags}
                    isLoading={isEntitiesLoading}
                    entities={entities.filter((entity) => entity.enabled)}
                    user={user}
                  />
                </TabsContent>
                <TabsContent value="cambio">
                  <CambioForm
                    main_name={main_name}
                    mainTags={mainTags}
                    entities={entities.filter((entity) => entity.enabled)}
                    user={user}
                    isLoading={isEntitiesLoading}
                  />
                </TabsContent>
                <TabsContent value="cable">
                  <CableForm
                    mainTags={mainTags}
                    entities={entities.filter((entity) => entity.enabled)}
                    user={user}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-y-8">
            <InitialDataOperationForm
              accountingPeriodDate={accountingPeriodDate}
              user={user}
            />
            <Link href="/operaciones/carga/pendientes">
              <Button className="flex flex-row gap-x-2">
                <p>Transacciones pendientes</p>
                <Icons.pending className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        )}
      </div>
      <div className="lg:col-span-1">
        <UploadedUserOperations
          user={user}
          entities={entities.filter((entity) => entity.enabled)}
          mainTags={mainTags}
          users={users}
          accountingPeriodDate={accountingPeriodDate}
          operationsData={initialOperations}
          ref={parent}
        />
      </div>
    </div>
  );
};

export default AddOperation;
