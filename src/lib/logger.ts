import { Logtail } from "@logtail/node";

const logtail = new Logtail("9nfEHmTfaRWfafp5oWQExdEm", {
  endpoint: "https://s1468682.eu-nbg-2.betterstackdata.com",
  sendLogsToBetterStack: process.env.NODE_ENV === "production",
  sendLogsToConsoleOutput: process.env.NODE_ENV === "development",
});

// Utility function to safely serialize objects for logging
export const safeSerialize = (obj: unknown): unknown => {
  const seen = new WeakSet();

  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular Reference]";
        }
        seen.add(value);
      }
      return value;
    }),
  );
};

export default logtail;
