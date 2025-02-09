import moment from "moment";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import ExchangesList from "./ExchangesList";
import UploadExchanges from "./UploadExchanges";

const Page = async () => {
  const user = await getUser();

  const canEditExchangeRates =
    user?.permissions?.some(
      (p) => p.name === "ADMIN" || p.name === "UNIFIED_CURRENCIES_EDIT",
    ) ?? false;

  const initialExchangeRates =
    await api.exchangeRates.getAllExchangeRates.query({
      page: 1,
    });

  const currentDateExchangeRates =
    await api.exchangeRates.getDateExchangeRates.query({
      date: moment().format("YYYY-MM-DD"),
    });

  return (
    <div className="flex w-full flex-col gap-y-8">
      {canEditExchangeRates && (
        <UploadExchanges initialCurrentDateRates={currentDateExchangeRates} />
      )}
      <ExchangesList initialExchangeRates={initialExchangeRates} />
    </div>
  );
};

export default Page;
