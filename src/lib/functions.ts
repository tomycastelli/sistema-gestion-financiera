import moment from "moment";
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
  changedById: string,
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
    changedBy: changedById,
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
  searchParams: URLSearchParams | undefined,
  name: string,
  value: string,
  deleteParam?: string,
): string => {
  const params = searchParams
    ? new URLSearchParams(searchParams.toString())
    : new URLSearchParams();

  // Delete the specified parameter if deleteParam is provided
  if (deleteParam) {
    params.delete(deleteParam);
  }

  params.set(name, value);
  return params.toString();
};

export const removeQueryString = (
  searchParams: URLSearchParams,
  names: string[] | string,
): string => {
  const params = new URLSearchParams(searchParams);

  if (typeof names === "string") {
    params.delete(names);
  } else {
    names.forEach((name) => params.delete(name));
  }

  return params.toString();
};

type GenerateLinkParams = {
  selectedClient: string | null;
  linkId: number | null;
  linkToken: string | null;
};

export const generateLink = ({
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
  const url = `${queryParams.toString()}`;
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
  timeframe: "daily" | "weekly" | "monthly" | "yearly",
) => {
  return balances.map((entity) => {
    const result: {
      currency: string;
      status: boolean;
      amount: number;
      beforeAmount: number;
    }[] = [];

    entity.balances.forEach((balance) => {
      const currentDate = moment();

      // Calculate the duration based on the timeframe
      const duration =
        timeframe === "daily"
          ? 1
          : timeframe === "weekly"
          ? 7
          : timeframe === "monthly"
          ? 30
          : timeframe === "yearly"
          ? 365
          : 1; // Default to 1 if the timeframe is not recognized

      const startDate = currentDate.clone().subtract(duration, "days");

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
          beforeAmount: startDate.isBefore(balance.date) ? 0 : balance.amount,
        });
      } else {
        existingEntry.amount += balance.amount;
        existingEntry.beforeAmount += startDate.isBefore(balance.date)
          ? 0
          : balance.amount;
      }
    });

    return { ...entity, totalBalances: result };
  });
};

type OutputBalance = {
  currency: string;
  balances: {
    status: boolean;
    amount: number;
    beforeAmount: number;
  }[];
};

export const calculateTotalAllEntities = (
  balances: Balance,
  timeframe: "daily" | "weekly" | "monthly" | "yearly",
): OutputBalance[] => {
  const result: OutputBalance[] = [];

  balances.forEach((entity) => {
    entity.balances.forEach((balance) => {
      const currentDate = moment();

      // Calculate the duration based on the timeframe
      const duration =
        timeframe === "daily"
          ? 1
          : timeframe === "weekly"
          ? 7
          : timeframe === "monthly"
          ? 30
          : timeframe === "yearly"
          ? 365
          : 1; // Default to 1 if the timeframe is not recognized

      const startDate = currentDate.clone().subtract(duration, "days");

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
        existingBalance.beforeAmount += startDate.isBefore(balance.date)
          ? 0
          : balance.amount;
      }
    });
  });

  return result;
};

interface Tag {
  name: string;
  parent: string | null;
  color: string | null;
}

// Recursive function which looks the whole tree branch
export function isTagAllowed(
  allTags: Tag[],
  tagName: string,
  allowedTags: string[] | undefined,
): boolean {
  if (!allowedTags) {
    return false;
  }

  const tag = allTags.find((t) => t.name === tagName);

  if (!tag) {
    return false; // Tag not found, consider it not allowed
  }

  if (allowedTags.includes(tag.name)) {
    return true; // Tag directly allowed
  }

  // Check if any parent is allowed
  if (tag.parent && isTagAllowed(allTags, tag.parent, allowedTags)) {
    return true;
  }

  return false; // Tag and its hierarchy are not allowed
}

export function getAllChildrenTags(
  tagNames: string | string[] | undefined,
  allTags: {
    name: string;
    parent: string | null;
    color: string | null;
    childTags: {
      name: string;
      parent: string | null;
      color: string | null;
    }[];
  }[],
  result: string[] = [],
): string[] {
  if (!tagNames) {
    return [];
  }
  const tagNamesArray = Array.isArray(tagNames) ? tagNames : [tagNames];

  for (const tagName of tagNamesArray) {
    // Find the tag in the array
    const currentTag = allTags.find((tag) => tag.name === tagName);

    // If the tag is found, add it to the result and continue with children
    if (currentTag) {
      result.push(currentTag.name);

      // Recursively find children of the current tag
      for (const child of currentTag.childTags) {
        getAllChildrenTags(child.name, allTags, result);
      }
    }
  }

  return result;
}

export function findColor(tag: Tag, allTags: Tag[]): string | null {
  if (tag.color !== null) {
    return tag.color; // If the tag itself has a color, return it
  }

  if (tag.parent !== null) {
    const parentTag = allTags.find((t) => t.name === tag.parent);
    if (parentTag) {
      return findColor(parentTag, allTags); // Recursively look for the color in the parent tag
    }
  }

  return null; // No color found in the tag or its parents
}

// Function to get the week key based on a date
export function getWeekKey(date: Date) {
  const year = date.getFullYear();
  const weekNumber = getISOWeekNumber(date);
  return `${year}-${weekNumber}`;
}

// Function to get the month key based on a date
export function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // Adding 1 because months are zero-indexed
  return `${year}-${month < 10 ? "0" : ""}${month}`;
}

// Function to get the year key based on a date
export function getYearKey(date: Date) {
  const year = date.getFullYear();
  return `${year}`;
}

// Function to get the ISO week number of a date
function getISOWeekNumber(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return weekNumber;
}

type BarChartEntry = {
  date: string;
  cash: number;
  current_account: number;
};

export const sortEntries = (a: BarChartEntry, b: BarChartEntry): number => {
  const momentA = moment(a.date, ["DD-MM-YYYY", "YYYY", "YYYY-ww", "YYYY-MM"]);
  const momentB = moment(b.date, ["DD-MM-YYYY", "YYYY", "YYYY-ww", "YYYY-MM"]);

  return momentA.diff(momentB);
};

export const isNumeric = (value: string) => /^[+-]?\d+(\.\d+)?$/.test(value);
