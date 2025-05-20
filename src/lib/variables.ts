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

export const gastoCategories = [
      {
        value: "GASTOS_DE_PERSONAL",
        label: "Gastos de Personal",
        subCategories: [
          {
            value: "SUELDOS",
            label: "Sueldos"
          },
          {
            value: "SEGURIDAD_SOCIAL_Y_APORTES",
            label: "Seguridad Social y Aportes"
          },
          {
            value: "HONORARIOS",
            label: "Honorarios"
          },
          {
            value: "CAPACITACION",
            label: "Capacitación"
          }
        ]
      },
      {
        value: "GASTOS_DE_ADMINISTRACION",
        label: "Gastos de Administración",
        subCategories: [
          {
            value: "ALQUILERES",
            label: "Alquileres"
          },
          {
            value: "EXPENSAS",
            label: "Expensas"
          },
          {
            value: "LUZ",
            label: "Luz"
          },
          {
            value: "AGUA",
            label: "Agua"
          },
          {
            value: "GAS",
            label: "Gas"
          },
          {
            value: "MATERIALES_DE_OFICINA",
            label: "Materiales de Oficina"
          },
          {
            value: "PAPELERIA_Y_UTILES",
            label: "Papelería y útiles"
          }
        ]
      },
      {
        value: "GASTOS_DE_COMUNICACION",
        label: "Gastos de Comunicación",
        subCategories: [
          {
            value: "TELEFONO_INTERNET",
            label: "Teléfono / Internet"
          },
          {
            value: "PUBLICIDAD_Y_MARKETING",
            label: "Publicidad y Marketing"
          },
          {
            value: "SUSCRIPCIONES",
            label: "Suscripciones"
          }
        ]
      },
      {
        value: "GASTOS_DE_MANTENIMIENTO",
        label: "Gastos de Mantenimiento",
        subCategories: [
          {
            value: "LIMPIEZA",
            label: "Limpieza"
          },
          {
            value: "REPARACIONES_Y_CONSERVACION",
            label: "Reparaciones y Conservación"
          }
        ]
      },
      {
        value: "OTROS_GASTOS_OPERATIVOS",
        label: "Otros Gastos Operativos",
        subCategories: [
          {
            value: "TRANSPORTE",
            label: "Transporte"
          },
          {
            value: "COMBUSTIBLE",
            label: "Combustible"
          },
          {
            value: "ALMACEN",
            label: "Almacén"
          },
          {
            value: "COMIDA",
            label: "Comida"
          },
          {
            value: "GASTOS_REPRESENTACION",
            label: "Gastos Representación"
          },
          {
            value: "SEGUROS",
            label: "Seguros"
          },
          {
            value: "ALARMA",
            label: "Alarma"
          },
          {
            value: "Gastos_Bancarios",
            label: "Gastos Bancarios"
          },
          {
            value: "VARIOS",
            label: "Varios"
          }
        ]
      },
      {
        value: "MOBILIARIO_Y_EQUIPAMIENTO",
        label: "Mobiliario y Equipamiento",
        subCategories: [
          {
            value: "COMPUTADORAS",
            label: "Computadoras"
          },
          {
            value: "TELEFONOS",
            label: "Teléfonos"
          },
          {
            value: "ELECTRODOMESTICOS",
            label: "Electrodomésticos"
          },
          {
            value: "MENAJES",
            label: "Menaje"
          },
          {
            value: "MUEBLES",
            label: "Muebles"
          }
        ]
      }
];

export const currentAccountOnlyTypes = new Set([
  "fee",
  "cuenta corriente",
  "cable",
]);
export const cashAccountOnlyTypes = new Set(["ingreso", "gasto"]);

export const fixedTags = ["Operadores", "Clientes"];
