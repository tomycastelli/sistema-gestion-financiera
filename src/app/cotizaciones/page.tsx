import { getUser } from "~/server/auth";
import UploadExchanges from "./UploadExchanges";
import ExchangesList from "./ExchangesList";
import moment from "moment";
import { api } from "~/trpc/server";
import { dateFormat } from "~/lib/variables";

const Page = async ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) => {
  const user = await getUser();

  const page = searchParams.pagina as string | null;
  const formatedPage = page ? parseInt(page) : 1;
  const currency = searchParams.divisa as string | null;
  const date = searchParams.fecha as string | null;
  const formatedDate = date
    ? moment(date, dateFormat).toDate()
    : moment().startOf("day").toDate();

  const canEditExchangeRates =
    user?.permissions?.some(
      (p) => p.name === "ADMIN" || p.name === "EXCHANGERATES_CREATE",
    ) ?? false;

  const initialExchangeRates =
    await api.exchangeRates.getAllExchangeRates.query({
      page: formatedPage,
      currency,
    });

  const currentDateExchangeRates =
    await api.exchangeRates.getDateExchangeRates.query({
      date: formatedDate,
    });

  return (
    <div className="grid w-full grid-rows-2 gap-y-8">
      {canEditExchangeRates && (
        <UploadExchanges
          initialCurrentDateRates={currentDateExchangeRates}
          list={{
            filterCurrency: currency ?? undefined,
            page: formatedPage,
          }}
        />
      )}
      <ExchangesList
        initialExchangeRates={initialExchangeRates}
        page={formatedPage}
        filterCurrency={currency ?? undefined}
      />
    </div>
  );
};

export default Page;
