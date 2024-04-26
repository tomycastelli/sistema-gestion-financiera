"use client"

import { useState, type FC, type ReactNode } from "react"
import { Drawer, DrawerContent, DrawerTrigger } from "./ui/drawer"
import { api } from "~/trpc/react";
import Operation from "../operaciones/gestion/Operation";
import { type User } from "lucia";
import { type RouterOutputs } from "~/trpc/shared";
import LoadingAnimation from "./LoadingAnimation";
import DetailMovementsTable from "../operaciones/gestion/[operationId]/DetailMovementsTable";

interface OperationDrawerProps {
  children: ReactNode,
  op?: RouterOutputs["operations"]["getOperations"]["operations"][number]
  opId?: number
  opDate?: Date
  user: User
  entities: RouterOutputs["entities"]["getAll"]
  users: RouterOutputs["users"]["getAll"]
  mainTags: string[]
  accountingPeriodDate: Date
}

const OperationDrawer: FC<OperationDrawerProps> = ({ children, op, opId, opDate, user, entities, users, mainTags, accountingPeriodDate }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const { data, isSuccess: isOperationSuccess, isRefetching: isOperationsRefetching } = api.operations.getOperations.useQuery({ operationId: op ? op.id : opId!, limit: 1, page: 1 }, {
    refetchOnWindowFocus: false, enabled: isOpen, initialData: op ? { operations: [op], count: 1 } : undefined
  })

  const { data: movements, isSuccess: isMovementsSuccess, isRefetching: isMovementsLoading } = api.movements.getMovementsByOpId.useQuery({ operationId: op ? op.id : opId! }, {
    refetchOnWindowFocus: false,
    enabled: isOpen
  })

  return (
    <Drawer shouldScaleBackground onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="flex flex-col rounded-t-[10px] h-full mt-24 max-h-[95%] fixed bottom-0 left-0 right-0">
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
          {!isOperationsRefetching ? isOperationSuccess && (
            <Operation
              op={data.operations[0]!}
              users={users}
              entities={entities}
              user={user}
              isInFeed={false}
              accountingPeriodDate={accountingPeriodDate}
              operationsQueryInput={{ operationId: op ? op.id : opId!, limit: 1, page: 1 }}
              mainTags={mainTags}
            />
          ) : (<LoadingAnimation text="Cargando operación..." />)}
          {!isMovementsLoading ? isMovementsSuccess && (
            <div className="justify-center items-center flex flex-col gap-4">
              <h1 className="mx-auto mt-10 text-4xl font-semibold tracking-tighter">
                Movimientos
              </h1>
              <DetailMovementsTable
                operationDate={op ? op.date : opDate!}
                movements={movements}
                operationId={op ? op.id : opId!}
              />
            </div>
          ) : (<LoadingAnimation text="Cargando movimientos..." />)}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export default OperationDrawer
