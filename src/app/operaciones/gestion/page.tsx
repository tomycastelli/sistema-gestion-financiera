import moment from "moment";
import Link from "next/link";
import { Suspense } from "react";
import LoadingAnimation from "~/app/components/LoadingAnimation";
import OperationsFeed from "~/app/components/OperationsFeed";
import { Icons } from "~/app/components/ui/Icons";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterInputs } from "~/trpc/shared";

const Page = async ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) => {
  const session = await getServerAuthSession();

  const selectedPage = (searchParams.pagina as string) ?? "1";
  const selectedFromEntity = searchParams.origen as string;
  const selectedToEntity = searchParams.destino as string;
  const selectedCurrency = searchParams.divisa as string;
  const selectedDate = searchParams.dia as string;
  const selectedDateGreater = searchParams.diaMin as string;
  const selectedDateLesser = searchParams.diaMax as string;
  const selectedType = searchParams.tipo as string;
  const selectedOperator = searchParams.operador as string;
  const selectedAmount = searchParams.monto as string;
  const selectedAmountGreater = searchParams.montoMin as string;
  const selectedAmountLesser = searchParams.montoMax as string;
  const selectedUploadUserId = searchParams.cargadoPor as string;
  const selectedConfirmationUserId = searchParams.confirmadoPor as string;

  const operationsQueryInput: RouterInputs["operations"]["getOperations"] = {
    limit: 8,
    page: parseInt(selectedPage),
  };

  if (selectedFromEntity) {
    operationsQueryInput.fromEntityId = parseInt(selectedFromEntity);
  }
  if (selectedToEntity) {
    operationsQueryInput.toEntityId = parseInt(selectedToEntity);
  }
  if (selectedCurrency) {
    operationsQueryInput.currency = selectedCurrency;
  }
  if (selectedDate) {
    operationsQueryInput.opDay = moment(selectedDate, "DD-MM-YYYY").toDate();
  } else if (selectedDateGreater) {
    operationsQueryInput.opDateIsGreater = moment(
      selectedDateGreater,
      "DD-MM-YYYY",
    ).toDate();
  } else if (selectedDateLesser) {
    operationsQueryInput.opDateIsLesser = moment(
      selectedDateLesser,
      "DD-MM-YYYY",
    ).toDate();
  }
  if (selectedType) {
    operationsQueryInput.transactionType = selectedType;
  }
  if (selectedOperator) {
    operationsQueryInput.operatorEntityId = parseInt(selectedOperator);
  }
  if (selectedAmount) {
    operationsQueryInput.amount = parseFloat(selectedAmount);
  } else if (selectedAmountGreater) {
    operationsQueryInput.amountIsGreater = parseFloat(selectedAmountGreater);
  } else if (selectedAmountLesser) {
    operationsQueryInput.amountIsLesser = parseFloat(selectedAmountLesser);
  }
  if (selectedUploadUserId) {
    operationsQueryInput.uploadedById = selectedUploadUserId;
  }
  if (selectedConfirmationUserId) {
    operationsQueryInput.confirmedById = selectedConfirmationUserId;
  }

  const initialOperations = await api.operations.getOperations.query(
    operationsQueryInput,
  );

  const initialEntities = await api.entities.getAll.query();

  const users = await api.users.getAll.query();

  return (
    <div className="flex w-full flex-col">
      <h1 className="mb-4 text-4xl font-bold tracking-tighter">Operaciones</h1>
      <Suspense fallback={<LoadingAnimation text={"Cargando operaciones"} />}>
        {session && (
          <OperationsFeed
            users={users}
            initialEntities={initialEntities}
            initialOperations={initialOperations}
            operationsQueryInput={operationsQueryInput}
            user={session.user}
          />
        )}
      </Suspense>
      <div className="flex flex-row justify-end space-x-2">
        {operationsQueryInput.page > 1 && (
          <Link
            className="flex flex-row items-center space-x-1 rounded-xl border-2 border-foreground p-2 transition-all hover:scale-110 hover:bg-slate-100"
            href={{
              pathname: "/operaciones/gestion",
              query: { pagina: parseInt(selectedPage) - 1 },
            }}
          >
            <Icons.chevronLeft className="h-5" />
            Anterior
          </Link>
        )}
        {initialOperations.length === operationsQueryInput.limit && (
          <Link
            className="flex flex-row items-center space-x-1 rounded-xl border-2 border-foreground p-2 transition-all hover:scale-110 hover:bg-slate-100"
            href={{
              pathname: "/operaciones/gestion",
              query: { pagina: parseInt(selectedPage) + 1 },
            }}
          >
            Siguiente <Icons.chevronRight className="h-5" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default Page;
