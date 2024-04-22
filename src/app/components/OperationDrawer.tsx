"use client"

import { type FC, type ReactNode } from "react"
import { Drawer, DrawerContent, DrawerTrigger } from "./ui/drawer"
import { api } from "~/trpc/react";
import Operation from "../operaciones/gestion/Operation";
import { type User } from "lucia";
import { type RouterOutputs } from "~/trpc/shared";
import LoadingAnimation from "./LoadingAnimation";
import DetailMovementsTable from "../operaciones/gestion/[operationId]/DetailMovementsTable";

interface OperationDrawerProps {
  children: ReactNode,
  opId: number;
  user: User
  entities: RouterOutputs["entities"]["getAll"]
  users: RouterOutputs["users"]["getAll"]
  mainTags: string[]
  accountingPeriodDate: Date
}

const OperationDrawer: FC<OperationDrawerProps> = ({ children, opId, user, entities, users, mainTags, accountingPeriodDate }) => {
  const { data, isLoading, isSuccess } = api.operations.getOperations.useQuery({ operationId: opId, page: 1, limit: 1 })

  const { data: movements, isSuccess: isMovementsSuccess } = api.movements.getMovementsByOpId.useQuery({ operationId: opId })

  return (
    <Drawer shouldScaleBackground>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="flex flex-col rounded-t-[10px] h-full mt-24 max-h-[95%] fixed bottom-0 left-0 right-0">
        {isLoading ? (
          <LoadingAnimation text="Cargando operación" />
        ) : isSuccess && (
          <div className="flex flex-col gap-y-2 overflow-auto mx-4 mb-10">
            <div className="grid lg:grid-cols-9 lg:grid-rows-1 grid-rows-2 p-4">
              <div className="lg:col-span-5 row-span-1"></div>
              <div className="lg:col-span-4 row-span-1 grid grid-cols-3">
                <div className="col-span-1 w-full flex flex-row items-center justify-start">
                  <p className="text-3xl font-semibold">Entrada</p>
                </div>
                <div className="col-span-1 flex flex-row items-center justify-start">
                  <p className="text-3xl font-semibold">Salida</p>
                </div>
                <div className="col-span-1"></div>
              </div>
            </div>
            <Operation
              op={data.operations[0]!}
              users={users}
              entities={entities}
              user={user}
              isInFeed={false}
              accountingPeriodDate={accountingPeriodDate}
              operationsQueryInput={{ operationId: opId, limit: 1, page: 1 }}
              mainTags={mainTags}
            />
            {isMovementsSuccess && (
              <div className="justify-center items-center flex flex-col gap-4">
                <h1 className="mx-auto mt-10 text-4xl font-semibold tracking-tighter">
                  Movimientos
                </h1>
                <DetailMovementsTable
                  operationDate={data.operations[0]!.date}
                  initialMovements={movements}
                  operationId={opId}
                />
              </div>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

export default OperationDrawer
