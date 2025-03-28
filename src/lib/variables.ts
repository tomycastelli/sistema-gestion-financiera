export const LOCK_MOVEMENTS_KEY = "sharedMovementsKey";

export const dateFormat = "DD-MM-YYYY";

export const dateFormatting = {
  day: "DD-MM-YYYY",
  week: "W-MM-YYYY",
  month: "MM-YYYY",
  year: "YYYY",
};

export const mvTypeFormatting = new Map<string, string>([
  ["cancellation", "Cancelación"],
  ["confirmation", "Confirmación"],
  ["upload", "Carga"],
]);

export const colors = [
  {
    label: "Rojo",
    value: "red",
  },
  {
    label: "Verde",
    value: "green",
  },
  {
    label: "Naranja",
    value: "orange",
  },
  {
    label: "Azul",
    value: "primary",
  },
  {
    label: "Amarillo",
    value: "amber-400",
  },
  {
    label: "Violeta",
    value: "violet-500",
  },
  {
    label: "Rosa",
    value: "pink-500",
  },
  {
    label: "Celeste",
    value: "blue-400",
  },
];

export const currencies = [
  {
    value: "usd",
    label: "USD",
    strong: 4,
    color: "#95cf92",
  },
  {
    value: "usdt",
    label: "USDT",
    strong: 4,
    color: "#369acc",
  },
  {
    value: "ars",
    label: "ARS",
    strong: 1,
    color: "#f4895f",
  },
  {
    value: "eur",
    label: "EUR",
    strong: 3,
    color: "#9656a2",
  },
  {
    value: "brl",
    label: "BRL",
    strong: 2,
    color: "#de324c",
  },
  {
    value: "gbp",
    label: "GBP",
    strong: 3,
    color: "#f8e16f",
  },
];

export const currenciesOrder = ["usd", "usdt", "ars", "eur", "brl", "gbp"];

export const paymentMethods = [
  {
    value: "cash",
    label: "Cash",
  },
  {
    value: "bank transfer",
    label: "Transferencia",
  },
];

export const operationTypes = [
  {
    value: "cambio",
    label: "Cambio",
  },
  {
    value: "cable",
    label: "Cable",
  },
  {
    value: "cuenta corriente",
    label: "Cuenta corriente",
  },
  {
    value: "pago por cta cte",
    label: "Pago por Cta Cte",
  },
  {
    value: "ingreso",
    label: "Ingreso",
  },
  {
    value: "fee",
    label: "Fee",
  },
  {
    value: "gasto",
    label: "Gasto",
  },
];

export const currentAccountOnlyTypes = new Set([
  "fee",
  "cuenta corriente",
  "cable",
]);
export const cashAccountOnlyTypes = new Set(["ingreso", "gasto"]);

export const fixedTags = ["Operadores", "Clientes"];
