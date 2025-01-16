import moment from "moment";
import { dateFormat } from "~/lib/variables";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import ExchangesList from "./ExchangesList";
import UploadExchanges from "./UploadExchanges";

const Page = async ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) => {
  const user = await getUser();

  const currency = searchParams.divisa as string | null;
  const date = searchParams.fecha as string | null;
  const formatedDate = date
    ? moment(date, dateFormat).toDate()
    : moment().startOf("day").toDate();

  const canEditExchangeRates =
    user?.permissions?.some(
      (p) => p.name === "ADMIN" || p.name === "UNIFIED_CURRENCIES_EDIT",
    ) ?? false;

  const initialExchangeRates =
    await api.exchangeRates.getAllExchangeRates.query({
      page: 1,
      currency,
    });

  const currentDateExchangeRates =
    await api.exchangeRates.getDateExchangeRates.query({
      date: formatedDate,
    });

  return (
    <div className="grid w-full grid-rows-2 gap-y-8">
      {canEditExchangeRates && (
        <UploadExchanges initialCurrentDateRates={currentDateExchangeRates} />
      )}
      <ExchangesList
        initialExchangeRates={initialExchangeRates}
        filterCurrency={currency ?? undefined}
      />
    </div>
  );
};

export default Page;
