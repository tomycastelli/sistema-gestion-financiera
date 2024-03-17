import moment from "moment";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import CustomPagination from "~/app/components/CustomPagination";
import OperationsFeed from "~/app/components/OperationsFeed";
import FilterOperationsForm from "~/app/components/forms/FilterOperationsForm";
import { Separator } from "~/app/components/ui/separator";
import { dateFormatting } from "~/lib/variables";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterInputs } from "~/trpc/shared";
const LoadingAnimation = dynamic(
  () => import("~/app/components/LoadingAnimation"),
);

const Page = async ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) => {
  const user = await getUser();

  const selectedPage = (searchParams.pagina as string) ?? "1";
  const selectedFromEntity = searchParams.origen as string[];
  const selectedToEntity = searchParams.destino as string[];
  const selectedCurrency = searchParams.divisa as string;
  const selectedDateGreater = searchParams.diaDesde as string | undefined;
  const selectedDateLesser = searchParams.diaHasta as string | undefined;
  const selectedType = searchParams.tipo as string;
  const selectedOperator = searchParams.operador as string[];
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
    operationsQueryInput.fromEntityId = selectedFromEntity.map((str) =>
      parseInt(str),
    );
  }
  if (selectedToEntity) {
    operationsQueryInput.toEntityId = selectedToEntity.map((str) =>
      parseInt(str),
    );
  }
  if (selectedCurrency) {
    operationsQueryInput.currency = selectedCurrency;
  }
  if (selectedDateGreater) {
    operationsQueryInput.opDateIsGreater = moment(
      selectedDateGreater,
      dateFormatting.day,
    ).toDate();
  }
  if (selectedDateLesser) {
    operationsQueryInput.opDateIsLesser = moment(
      selectedDateLesser,
      dateFormatting.day,
    ).toDate();
  }
  if (selectedType) {
    operationsQueryInput.transactionType = selectedType;
  }
  if (selectedOperator) {
    operationsQueryInput.operatorEntityId = selectedOperator.map((str) =>
      parseInt(str),
    );
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
      {user && (
        <>
          <div className="flex flex-col justify-start">
            <FilterOperationsForm entities={initialEntities} users={users} />
            <Separator className="my-4" />
            <CustomPagination
              itemName="operaciones"
              page={operationsQueryInput.page}
              pageSize={operationsQueryInput.limit}
              totalCount={initialOperations.count}
              pathname="/operaciones/gestion"
            />
          </div>
          <Suspense
            fallback={<LoadingAnimation text={"Cargando operaciones"} />}
          >
            <OperationsFeed
              users={users}
              initialEntities={initialEntities}
              initialOperations={initialOperations}
              operationsQueryInput={operationsQueryInput}
              user={user}
            />
          </Suspense>
          <CustomPagination
            page={operationsQueryInput.page}
            pageSize={operationsQueryInput.limit}
            totalCount={initialOperations.count}
            pathname="/operaciones/gestion"
            itemName="operaciones"
          />
        </>
      )}
    </div>
  );
};

export default Page;
