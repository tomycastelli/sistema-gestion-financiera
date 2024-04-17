import moment from "moment";
import { type ReadonlyURLSearchParams } from "next/navigation";
import { type z } from "zod";
import { type returnedBalancesSchema } from "~/server/db/schema";
import type { RouterOutputs } from "~/trpc/shared";

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

export const parseFormattedFloat = (input: string): number => {
  return parseFloat(input.replace(/\./g, "").replace(",", "."))
}

export const numberFormatter = (n: number, maximumFractionDigits = 2): string => {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits }).format(n)
}

export const safeJsonParse = <T>(str: string) => {
  try {
    const jsonValue: T = JSON.parse(str);

    return jsonValue;
  } catch {
    return undefined;
  }
};

export function lightenColor(color: string, lightness: number): string {
  // Check for valid hex code format
  if (!color.startsWith("#") || color.length !== 7) {
    throw new Error("Invalid hex color format. Please use #RRGGBB format.");
  }

  // Remove the "#" symbol
  const rgb = color.slice(1);

  // Convert each hex digit (0-F) to integer (0-255) using slice and parseInt
  const r = parseInt(rgb.substring(0, 2), 16);
  const g = parseInt(rgb.substring(2, 4), 16);
  const b = parseInt(rgb.substring(4, 6), 16);

  // Calculate lightening factor (0.0 to 1.0)
  const lightnessFactor = (100 - lightness) / 100.0;

  // Lighten each color component
  const newR = Math.floor(Math.max(0, r + (255 - r) * lightnessFactor));
  const newG = Math.floor(Math.max(0, g + (255 - g) * lightnessFactor));
  const newB = Math.floor(Math.max(0, b + (255 - b) * lightnessFactor));

  // Convert lightened RGB values back to hex format (0-F)
  const newHex = `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;

  return newHex;
}

export const capitalizeFirstLetter = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function isDarkEnough(hexColor: string): boolean {
  const rgbRegex = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
  const match = rgbRegex.exec(hexColor);

  if (!match) {
    throw new Error(`Invalid hex color format: ${hexColor}`);
  }

  const rgb = match.slice(1).map((value) => parseInt(value, 16));

  const getRelativeLuminance = (value: number): number => {
    return (value / 255) > 0.03928
      ? Math.pow((value / 255), 2.2)
      : (value / 255) / 12.92;
  };

  const relativeLuminance = rgb
    .map(getRelativeLuminance)
    .reduce((acc, val) => acc + val, 0) // Sum relative luminance
    .toFixed(2); // Round to 2 decimal places

  return parseFloat(relativeLuminance) >= 1.0; // Adjust for large text (3:1)
}

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
  searchParams: URLSearchParams | ReadonlyURLSearchParams | undefined,
  name: string,
  value: string | string[],
  deleteParam?: string,
): string => {
  const params = searchParams
    ? new URLSearchParams(searchParams.toString())
    : new URLSearchParams();

  // Delete the specified parameter if deleteParam is provided
  if (deleteParam) {
    params.delete(deleteParam);
  }

  if (Array.isArray(value)) {
    value.forEach((v) => params.append(name, v));
  } else {
    params.set(name, value);
  }
  return params.toString();
};

export const removeQueryString = (
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
  names: string[] | string,
): string => {
  const params = searchParams
    ? new URLSearchParams(searchParams.toString())
    : new URLSearchParams();
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
  tagNames: string[] | string | undefined | null,
  allTags: {
    name: string;
    parent: string | null;
    color: string | null;
    children: {
      name: string;
      parent: string | null;
      color: string | null;
    }[];
  }[],
  result: string[] = [],
): string[] {
  if (!tagNames) {
    return []
  }
  if (typeof tagNames === "string") {
    // Find the tag in the array
    const currentTag = allTags.find((tag) => tag.name === tagNames);


    // If the tag is found, add it to the result and continue with children
    if (currentTag) {
      result.push(currentTag.name);

      if (currentTag.children) {
        // Recursively find children of the current tag
        for (const child of currentTag.children) {
          getAllChildrenTags(child.name, allTags, result);
        }
      }
    }
  } else {
    for (const tagName of tagNames) {
      // Find the tag in the array
      const currentTag = allTags.find((tag) => tag.name === tagName);


      // If the tag is found, add it to the result and continue with children
      if (currentTag) {
        result.push(currentTag.name);

        if (currentTag.children) {
          // Recursively find children of the current tag
          for (const child of currentTag.children) {
            getAllChildrenTags(child.name, allTags, result);
          }
        }
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

interface HeadingNode {
  text: string;
  children?: HeadingNode[];
}

export function getHeadingsTree(mdxContent: string): HeadingNode[] {
  const regex = /^#{2,3}\s+(.*)/gm;
  const matches = mdxContent.match(regex);

  const headings = matches ? matches.map((match) => match.trim()) : [];

  const root: HeadingNode[] = [];

  headings.forEach((heading) => {
    const level = heading.startsWith("###") ? 3 : 2;
    const node: HeadingNode = {
      text: heading.replace(/^#{2,3}\s+/, ""),
      children: level === 3 ? undefined : [],
    };

    if (level === 2) {
      root.push(node);
    } else if (level === 3) {
      root.findLast(() => true)?.children?.push(node);
    }
  });

  return root;
}

export function convertToSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, "-")
    .trim();
}

export const movementBalanceDirection = (
  fromEntityId: number,
  toEntityId: number,
  direction: number,
) => {
  return fromEntityId < toEntityId ? -1 * direction : direction;
};

// Function to calculate the beforeAmount based on the duration
export const calculateBeforeAmount = (
  balancesData: z.infer<typeof returnedBalancesSchema>[],
  duration: "day" | "week" | "month" | "year",
): number => {
  const currentDate = moment();

  const filteredBalances = balancesData.filter((balance) =>
    moment(balance.date).isBefore(currentDate, duration),
  );

  return filteredBalances.reduce(
    (total, balance) => total + balance.balance,
    0,
  );
};

export const generateTableData = (
  movements: RouterOutputs["movements"]["getCurrentAccounts"]["movements"],
  entityId: number | undefined | null,
  entityTag: string | undefined | null,
  allTags: RouterOutputs["tags"]["getAll"] | undefined | null,
) => {
  const tableData = movements
    .map((movement) => {
      if (entityId) {
        // Esto indica, si es 1, que gano, si es -1, que pierdo
        const direction =
          entityId === movement.transaction.fromEntityId
            ? -movement.direction
            : movement.direction;
        const selectedEntity =
          entityId === movement.transaction.fromEntityId
            ? movement.transaction.fromEntity
            : movement.transaction.toEntity;
        const otherEntity =
          entityId === movement.transaction.fromEntityId
            ? movement.transaction.toEntity
            : movement.transaction.fromEntity;

        return {
          id: movement.id,
          date: moment(movement.transaction.operation.date).format(
            "DD-MM-YYYY HH:mm",
          ),
          operationId: movement.transaction.operationId,
          observations: movement.transaction.operation.observations,
          type: movement.type,
          account: movement.account,
          otherEntityId: otherEntity.id,
          otherEntity: otherEntity.name,
          selectedEntityId: selectedEntity.id,
          selectedEntity: selectedEntity.name,
          currency: movement.transaction.currency,
          ingress: direction === 1 ? movement.transaction.amount : 0,
          egress: direction === -1 ? movement.transaction.amount : 0,
          method: movement.transaction.method,
          status: movement.transaction.status,
          txType: movement.transaction.type,
          metadata: movement.transaction.transactionMetadata?.metadata,
          balance:
            selectedEntity.id < otherEntity.id
              ? movement.balance
              : -movement.balance,
        };
      } else {
        const allChildrenTags = getAllChildrenTags(entityTag, allTags!);
        // Esto indica, si es 1, que gano, si es -1, que pierdo
        const direction = allChildrenTags.includes(
          movement.transaction.fromEntity.tagName,
        )
          ? -movement.direction
          : movement.direction;
        const selectedEntity = allChildrenTags.includes(
          movement.transaction.fromEntity.tagName,
        )
          ? movement.transaction.fromEntity
          : movement.transaction.toEntity;
        const otherEntity = allChildrenTags.includes(
          movement.transaction.fromEntity.tagName,
        )
          ? movement.transaction.toEntity
          : movement.transaction.fromEntity;

        return {
          id: movement.id,
          date: moment(movement.transaction.operation.date).format(
            "DD-MM-YYYY HH:mm",
          ),
          operationId: movement.transaction.operationId,
          observations: movement.transaction.operation.observations,
          type: movement.type,
          otherEntityId: otherEntity.id,
          otherEntity: otherEntity.name,
          selectedEntityId: selectedEntity.id,
          selectedEntity: selectedEntity.name,
          currency: movement.transaction.currency,
          ingress: direction === 1 ? movement.transaction.amount : 0,
          egress: direction === -1 ? movement.transaction.amount : 0,
          method: movement.transaction.method,
          status: movement.transaction.status,
          txType: movement.transaction.type,
          metadata: movement.transaction.transactionMetadata?.metadata,
          balance:
            selectedEntity.id < otherEntity.id
              ? movement.balance
              : -movement.balance,
        };
      }
    })

  return tableData;
};

export function timeout(delay: number) {
  return new Promise(res => setTimeout(res, delay));
}

export const getAccountingPeriodDate = (months: number, graceDays: number): Date => {
  if (moment().date() <= graceDays) {
    return moment().startOf("month").subtract(months, "month").toDate()
  } else {
    return moment().startOf("month").subtract(months - 1, "month").toDate()
  }
}
