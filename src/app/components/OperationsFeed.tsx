"use client";

import { type User } from "lucia";
import dynamic from "next/dynamic";
import { type FC, useEffect } from "react";
import { toast } from "sonner";
import { useFirstRender } from "~/hooks/useFirstRender";
import { Status } from "~/server/db/schema";
import { useOperationsPageStore } from "~/stores/OperationsPage";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import Operation from "../operaciones/gestion/Operation";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";
const LoadingAnimation = dynamic(
  () => import("../components/LoadingAnimation"),
);

interface OperationsFeedProps {
  initialOperations: RouterOutputs["operations"]["getOperations"];
  users: RouterOutputs["users"]["getAll"];
  initialEntities: RouterOutputs["entities"]["getAll"];
  operationsQueryInput: RouterInputs["operations"]["getOperations"];
  user: User;
  mainTags: string[];
  accountingPeriodDate: Date;
}

const OperationsFeed: FC<OperationsFeedProps> = ({
  initialOperations,
  users,
  user,
  initialEntities,
  operationsQueryInput,
  accountingPeriodDate,
  mainTags,
}) => {
  const { data, isRefetching, refetch } = api.operations.getOperations.useQuery(
    operationsQueryInput,
    {
      initialData: initialOperations,
      refetchOnWindowFocus: false,
    },
  );

  const { data: entities } = api.entities.getAll.useQuery(undefined, {
    initialData: initialEntities,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { mutateAsync: getUrlAsync, isLoading: isUrlLoading } =
    api.files.getOperationData.useMutation({
      onSuccess(newOperation) {
        const link = document.createElement("a");
        link.href = newOperation.downloadUrl;
        link.download = newOperation.filename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
      onError(err) {
        toast.error("Error al generar el archivo", {
          description: err.message,
        });
      },
    });

  const onDownloadClick = (fileType: "pdf" | "xlsx") => {
    if (data.count > 1000) {
      toast.warning("Vas a generar un archivo con mas de 1000 operaciones", {
        action: {
          label: "Generar",
          onClick: () => {
            const promise = getUrlAsync({
              ...operationsQueryInput,
              fileType,
              operationsCount: data.count,
            });

            toast.promise(promise, {
              loading: "Generando archivo...",
              success(data) {
                return `Archivo generado: ${data.filename}`;
              },
              error() {
                return `Error al generar el archivo`;
              },
            });
          },
        },
      });
    } else {
      const promise = getUrlAsync({
        ...operationsQueryInput,
        fileType,
        operationsCount: data.count,
      });

      toast.promise(promise, {
        loading: "Generando archivo...",
        success(data) {
          return `Archivo generado: ${data.filename}`;
        },
        error() {
          return `Error al generar el archivo`;
        },
      });
    }
  };

  const utils = api.useContext();

  const { mutateAsync: updateTransaction } =
    api.editingOperations.updateTransactionStatus.useMutation({
      onSettled() {
        resetTxIds();
        void utils.operations.getOperations.invalidate();
        void utils.movements.getMovementsByOpId.invalidate();
        void utils.movements.getCurrentAccounts.invalidate();
        void utils.movements.getBalancesByEntities.invalidate();
      },
    });

  const { txIdsStore, resetTxIds, changeTxIds } = useOperationsPageStore();

  const firstRender = useFirstRender();

  useEffect(() => {
    if (firstRender) return;
    if (txIdsStore.length > 0) {
      toast.info("Lista de transacciones", {
        description: txIdsStore.join(", "),
        action: txIdsStore.length > 0 && {
          label: "Confirmar transacciones",
          onClick: () => {
            const promise = updateTransaction({ transactionIds: txIdsStore });
            toast.promise(promise, {
              loading: "Confirmando transacciones...",
              success: () => {
                resetTxIds();
                return "Transacciones confirmadas";
              },
              error: (error) => {
                return `Error al confirmar transacciones: ${error.message}`;
              },
            });
          },
        },
      });
    } else {
      toast.dismiss();
    }
  }, [txIdsStore, updateTransaction, firstRender, resetTxIds]);

  return (
    <div className="my-4 flex flex-col">
      <div className="flex flex-row justify-between gap-x-2">
        <div className="flex flex-row gap-x-2">
          <Button
            tooltip="Recargar operaciones"
            className="flex w-min"
            variant="outline"
            onClick={() => refetch()}
          >
            <Icons.reload className="h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {!isUrlLoading ? (
                <Button variant="outline" tooltip="Descargar">
                  <Icons.download className="h-5" />
                </Button>
              ) : (
                <p>Cargando...</p>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Extensión</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onDownloadClick("pdf")}>
                  <Icons.pdf className="h-4" />
                  <span>PDF</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownloadClick("xlsx")}>
                  <Icons.excel className="h-4" />
                  <span>Excel</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {txIdsStore.length > 0 && (
          <div className="flex flex-col justify-end gap-y-2">
            <p className="font-semibold">Transacciones a confirmar</p>
            <div className="ml-2 flex flex-row gap-x-1">
              {txIdsStore.map((txId) => (
                <Button
                  tooltip="Eliminar de la cola"
                  onClick={() => changeTxIds(txId)}
                  key={txId}
                  variant="outline"
                >
                  {txId}
                </Button>
              ))}
              <Button
                tooltip="Confirmar transacciones"
                onClick={() => {
                  void updateTransaction({ transactionIds: txIdsStore });
                  resetTxIds();
                }}
                variant="outline"
              >
                <Icons.documentPlus className="h-5 text-green" />
              </Button>
              <Button
                tooltip="Eliminar cola de transacciones"
                variant="outline"
                onClick={() => resetTxIds()}
              >
                <Icons.documentMinus className="h-5 text-red" />
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-y-4">
        <div className="grid grid-rows-2 p-4 lg:grid-cols-9 lg:grid-rows-1">
          <div className="row-span-1 lg:col-span-5"></div>
          <div className="row-span-1 grid grid-cols-3 lg:col-span-4">
            <div className="col-span-1 flex w-full flex-row items-center justify-start">
              <p className="text-3xl font-semibold">Entrada</p>
            </div>
            <div className="col-span-1 flex flex-row items-center justify-start">
              <p className="text-3xl font-semibold">Salida</p>
            </div>
            <div className="col-span-1"></div>
          </div>
        </div>
        {isRefetching ? (
          <LoadingAnimation text={"Cargando operaciones"} />
        ) : data.operations.length > 0 ? (
          data.operations
            .filter((op) => op.isVisualizeAllowed)
            .map((op) => {
              return (
                <Operation
                  accountingPeriodDate={accountingPeriodDate}
                  key={op.id}
                  users={users}
                  entities={entities}
                  isInFeed={true}
                  operationsQueryInput={operationsQueryInput}
                  user={user}
                  op={op}
                  mainTags={mainTags}
                />
              );
            })
        ) : (
          <p className="my-8 text-4xl">No se encontraron operaciones</p>
        )}
      </div>
    </div>
  );
};

export default OperationsFeed;
