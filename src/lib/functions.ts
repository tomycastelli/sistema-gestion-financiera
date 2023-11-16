import { env } from "~/env.mjs";
import { translations } from "./variables";

export const getInitials = (name: string): string => {
  const words: string[] = name.split(" ");
  if (words.length === 0) {
    return "";
  } else if (words.length === 1) {
    return words[0]?.slice(0, 2) ?? "";
  } else {
    return `${words[0]?.charAt(0) ?? ""}${words[1]?.charAt(0) ?? ""}`;
  }
};

export const capitalizeFirstLetter = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const getCurrentTime = () => {
  const now = new Date();
  const currentTime = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  return currentTime;
};

export function formatDateString(dateString: string) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

export const decideCache = (
  queryLimit: number,
  pageNumber: number,
  cachedOperationsLength: number,
): number => {
  const totalPages = Math.ceil(cachedOperationsLength / queryLimit);

  if (pageNumber <= totalPages) {
    const remainingOperations =
      cachedOperationsLength - (pageNumber - 1) * queryLimit;
    const operationsToFetch = Math.max(0, queryLimit - remainingOperations);

    return operationsToFetch;
  }

  return queryLimit;
};

export const paginateArray = <T>(
  array: T[],
  pageSize: number,
  pageNumber: number,
): T[] => {
  const startIndex = (pageNumber - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return array.slice(startIndex, endIndex);
};

export function translateWord(word: string): string {
  return translations[word] ?? word;
}

type Changes<T> = {
  before: T;
  after: T;
};

export const findDifferences = <T>(
  oldObject: T,
  newObject: T,
  changedBy: string,
): {
  changeData: Array<Changes<T[keyof T] & { key: string }>>;
  changeDate: string;
  changedBy: string;
} => {
  const changes: Array<Changes<T[keyof T] & { key: string }>> = [];
  for (const key in newObject) {
    if (oldObject[key as keyof T] !== newObject[key as keyof T]) {
      changes.push({
        key: key as string,
        before: oldObject[key as keyof T] as T[keyof T],
        after: newObject[key as keyof T] as T[keyof T],
      } as Changes<T[keyof T] & { key: string }>);
    }
  }
  return {
    changeData: changes,
    changeDate: new Date().toISOString(),
    changedBy: changedBy,
  };
};

export function hasOnlySpecificAttributes(
  obj: object,
  attributeList: string[],
): boolean {
  return Object.keys(obj).every((key) => attributeList.includes(key));
}

export const dateReviver = (keys: string[]) => (key: string, value: string) => {
  if (keys.includes(key as KeyType) && typeof value === "string") {
    return new Date(value);
  }
  return value;
};

export const createQueryString = (
  searchParams: URLSearchParams,
  name: string,
  value: string,
  deleteParam?: string,
): string => {
  const params = new URLSearchParams(searchParams.toString());

  // Delete the specified parameter if deleteParam is provided
  if (deleteParam) {
    params.delete(deleteParam);
  }

  params.set(name, value);
  return params.toString();
};

export const removeQueryString = (
  searchParams: URLSearchParams,
  name: string,
): string => {
  const params = new URLSearchParams(searchParams);
  params.delete(name);
  return params.toString();
};

type GenerateLinkParams = {
  pathname: string;
  selectedClient: string | null;
  linkId: number | null;
  linkToken: string | null;
};

export const generateLink = ({
  pathname,
  selectedClient,
  linkId,
  linkToken,
}: GenerateLinkParams): string => {
  const queryParams = new URLSearchParams();

  queryParams.append("cuenta", "cuenta_corriente");

  queryParams.append("pagina", "1");

  // Handle selectedClient
  if (selectedClient !== null) {
    queryParams.append("entidad", selectedClient);
  }

  // Handle linkId
  if (linkId !== null) {
    queryParams.append("id", linkId.toString());
  }

  // Handle linkToken
  if (linkToken !== null) {
    queryParams.append("token", linkToken);
  }

  // Construct the URL
  const url = `${env.NEXT_PUBLIC_URL}${pathname}?${queryParams.toString()}`;
  return url;
};

type Balance = {
  entityId: number;
  entityName: string;
  entityTag: string;
  balances: {
    currency: string;
    date: Date;
    status: boolean;
    amount: number;
  }[];
}[];

export const calculateTotal = (
  balances: Balance,
  timeframe: "daily" | "weekly" | "monthly",
) => {
  return balances.map((entity) => {
    const result: {
      currency: string;
      status: boolean;
      amount: number;
      beforeAmount: number;
    }[] = [];

    entity.balances.forEach((balance) => {
      const currentDate = balance.date;
      const oneDayBefore = new Date(currentDate);
      const oneWeekBefore = new Date(currentDate);
      const oneMonthBefore = new Date(currentDate);

      // Calculate one day, one week, and one month before dates
      oneDayBefore.setDate(currentDate.getDate() - 1);
      oneWeekBefore.setDate(currentDate.getDate() - 7);
      oneMonthBefore.setMonth(currentDate.getMonth() - 1);

      const isBeforeDate = (beforeDate: Date) => balance.date < beforeDate;

      // Choose the appropriate timeframe based on the parameter
      const beforeDate =
        timeframe === "daily"
          ? oneDayBefore
          : timeframe === "weekly"
          ? oneWeekBefore
          : timeframe === "monthly"
          ? oneMonthBefore
          : new Date(); // Default to the current date if timeframe is not recognized

      // Calculate total amount
      const existingEntry = result.find(
        (entry) =>
          entry.currency === balance.currency &&
          entry.status === balance.status,
      );

      if (!existingEntry) {
        result.push({
          currency: balance.currency,
          status: balance.status,
          amount: balance.amount,
          beforeAmount: isBeforeDate(beforeDate)
            ? 0
            : entity.balances
                .filter(
                  (b) =>
                    b.date < beforeDate &&
                    b.currency === balance.currency &&
                    b.status === balance.status,
                )
                .reduce((sum, b) => sum + b.amount, 0),
        });
      } else {
        existingEntry.amount += balance.amount;
        existingEntry.beforeAmount += isBeforeDate(beforeDate)
          ? 0
          : entity.balances
              .filter(
                (b) =>
                  b.date < beforeDate &&
                  b.currency === balance.currency &&
                  b.status === balance.status,
              )
              .reduce((sum, b) => sum + b.amount, 0);
      }
    });

    return { ...entity, totalBalances: result };
  });
};

export const calculateTotalAllEntities = (
  balances: Balance,
  timeframe: "daily" | "weekly" | "monthly",
) => {
  const result: {
    currency: string;
    balances: { status: boolean; amount: number; beforeAmount: number }[];
  }[] = [];

  balances.forEach((entity) => {
    entity.balances.forEach((balance) => {
      const currentDate = balance.date;
      const oneDayBefore = new Date(currentDate);
      const oneWeekBefore = new Date(currentDate);
      const oneMonthBefore = new Date(currentDate);

      // Calculate one day, one week, and one month before dates
      oneDayBefore.setDate(currentDate.getDate() - 1);
      oneWeekBefore.setDate(currentDate.getDate() - 7);
      oneMonthBefore.setMonth(currentDate.getMonth() - 1);

      const isBeforeDate = (beforeDate: Date) => balance.date < beforeDate;

      // Choose the appropriate timeframe based on the parameter
      const beforeDate =
        timeframe === "daily"
          ? oneDayBefore
          : timeframe === "weekly"
          ? oneWeekBefore
          : timeframe === "monthly"
          ? oneMonthBefore
          : new Date(); // Default to the current date if timeframe is not recognized

      const existingCurrency = result.find(
        (entry) => entry.currency === balance.currency,
      );

      if (!existingCurrency) {
        result.push({
          currency: balance.currency,
          balances: [
            {
              status: true,
              amount: 0,
              beforeAmount: 0,
            },
            {
              status: false,
              amount: 0,
              beforeAmount: 0,
            },
          ],
        });
      }

      const existingBalance = result
        .find((entry) => entry.currency === balance.currency)
        ?.balances.find((b) => b.status === balance.status);

      if (existingBalance) {
        existingBalance.amount += balance.amount;
        existingBalance.beforeAmount += isBeforeDate(beforeDate)
          ? 0
          : entity.balances
              .filter(
                (b) =>
                  b.date < beforeDate &&
                  b.currency === balance.currency &&
                  b.status === balance.status,
              )
              .reduce((sum, b) => sum + b.amount, 0);
      }
    });
  });

  return result;
};
