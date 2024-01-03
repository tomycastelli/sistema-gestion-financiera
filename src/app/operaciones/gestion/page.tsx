import moment from "moment";
import { Suspense } from "react";
import CustomPagination from "~/app/components/CustomPagination";
import LoadingAnimation from "~/app/components/LoadingAnimation";
import OperationsFeed from "~/app/components/OperationsFeed";
import FilterOperationsForm from "~/app/components/forms/FilterOperationsForm";
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
          <>
            <FilterOperationsForm entities={initialEntities} users={users} />
            <CustomPagination
              itemName="operaciones"
              page={operationsQueryInput.page}
              pageSize={operationsQueryInput.limit}
              totalCount={initialOperations.count}
              pathname="/operaciones/gestion"
            />
            <OperationsFeed
              users={users}
              initialEntities={initialEntities}
              initialOperations={initialOperations}
              operationsQueryInput={operationsQueryInput}
              user={session.user}
            />
            <CustomPagination
              page={operationsQueryInput.page}
              pageSize={operationsQueryInput.limit}
              totalCount={initialOperations.count}
              pathname="/operaciones/gestion"
              itemName="operaciones"
            />
          </>
        )}
      </Suspense>
    </div>
  );
};

export default Page;
