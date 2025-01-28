import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
import { and, gte, lte } from "drizzle-orm";
import moment from "moment";
import { unparse } from "papaparse";
import { z } from "zod";
import { env } from "~/env.mjs";
import { numberFormatter } from "~/lib/functions";
import {
  getOperationsInput,
  getOperationsProcedure,
} from "~/lib/operationsTrpcFunctions";
import { currentAccountsProcedure, getAllEntities } from "~/lib/trpcFunctions";
import { currenciesOrder } from "~/lib/variables";
import { exchangeRates } from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";
import { getCurrentAccountsInput } from "./movements";

export const filesRouter = createTRPCRouter({
  getCurrentAccount: protectedProcedure
    .input(
      getCurrentAccountsInput
        .extend({
          fileType: z.enum(["csv", "pdf"]),
        })
        .omit({ pageSize: true, pageNumber: true }),
    )
    .mutation(async ({ ctx, input }) => {
      const { movementsQuery: tableData } = await currentAccountsProcedure(
        {
          entityTag: input.entityTag,
          entityId: input.entityId,
          currency: input.currency,
          account: input.account,
          fromDate: input.fromDate,
          toDate: input.toDate,
          pageSize: 100000,
          pageNumber: 1,
          dayInPast: input.dayInPast,
          toEntityId: input.toEntityId,
          groupInTag: input.groupInTag,
          dateOrdering: input.dateOrdering,
        },
        ctx,
      );

      const entities = await getAllEntities(ctx.redis, ctx.db);

      const filename = `${
        input.account === false ? "cuenta_corriente" : "caja"
      }_fecha:${moment().format("DD-MM-YYYY-HH:mm:ss")}_entidad:${
        input.entityId
          ? entities.find((e) => e.id === input.entityId)?.name
          : input.entityTag
      }${
        input.fromDate
          ? `_desde:${moment(input.fromDate).format("DD-MM-YYYY")}`
          : ""
      }${
        input.toDate
          ? `_hasta:${moment(input.toDate).format("DD-MM-YYYY")}`
          : ""
      }${input.currency ? `_divisa:${input.currency}` : ""}.${input.fileType}`;

      if (input.fileType === "csv") {
        const csvData = tableData.map((mv) => ({
          fecha: moment(mv.date, "DD-MM-YYYY HH:mm").format("DD-MM-YYYY"),
          origen: mv.selectedEntity,
          cliente: mv.otherEntity,
          detalle: `${
            mv.type === "upload"
              ? "Carga"
              : mv.type === "confirmation"
              ? "Confirmación"
              : "Cancelación"
          } de ${mv.txType} - Nro ${mv.id}`,
          observaciones: mv.observations ?? "",
          divisa: mv.currency,
          entrada: mv.ingress,
          salida: mv.egress,
          saldo: mv.balance,
        }));

        const csv = unparse(csvData, { delimiter: "," });
        const putCommand = new PutObjectCommand({
          Bucket: ctx.s3.bucketNames.reports,
          Key: `cuentas/${filename}`,
          Body: Buffer.from(csv, "utf-8"),
        });

        await ctx.s3.client.send(putCommand);
      } else if (input.fileType === "pdf") {
        const data = tableData.map((mv) => ({
          fecha: moment(mv.date, "DD-MM-YYYY HH:mm").format("DD-MM-YYYY"),
          origen: mv.selectedEntity,
          cliente: mv.otherEntity,
          detalle: `${
            mv.type === "upload"
              ? "Carga"
              : mv.type === "confirmation"
              ? "Confirmación"
              : "Cancelación"
          } de ${mv.txType} - Nro ${mv.id}`,
          observaciones: mv.observations ?? "",
          entrada:
            mv.ingress === 0
              ? ""
              : mv.currency.toUpperCase() + " " + numberFormatter(mv.ingress),
          salida:
            mv.egress === 0
              ? ""
              : mv.currency.toUpperCase() + " " + numberFormatter(mv.egress),
          saldo: mv.currency.toUpperCase() + " " + numberFormatter(mv.balance),
        }));
        const htmlString =
          `<html>
          <body class="main-container">
          <div class="header-div">
            <h1 class="title">Cuenta corriente de ${
              input.entityId
                ? entities.find((e) => e.id === input.entityId)?.name
                : input.entityTag
            } ${
              input.toEntityId
                ? "con " + entities.find((e) => e.id === input.toEntityId)?.name
                : ""
            }</h1>
          </div>` +
          `
          <div class="table-container">
          <table class="table">
          <thead class="table-header">
            <tr>
            <th>Fecha</th>
            <th>Detalle</th>
            <th>Origen</th>
            ${!input.toEntityId ? "<th>Cliente</th>" : ""}
            <th>Entrada</th>
            <th>Salida</th>
            <th>Saldo</th>
            </tr>
          </thead>
          <tbody class="table-body">
            ${data
              .map(
                (mv, index) =>
                  `<tr key="${index}">
                  <td>${mv.fecha}</td>
                  <td>
                    <p class="observations-text">${mv.observaciones}</p>
                    <p class="details-text">${mv.detalle}</p>
                  </td>
                  <td>${mv.origen}</td>
                  ${!input.toEntityId ? `<td>${mv.cliente}</td>` : ""}
                  <td>${mv.entrada}</td>
                  <td>${mv.salida}</td>
                  <td>${mv.saldo}</td>
                  </tr>`,
              )
              .join("")}
            </tbody>
            </body>
            </html>`;

        const cssString = `.table-container{margin-top: 0.5rem;}
          .table{width: 100%; border-collapse: collapse;}
          .table-header{font-size: 1rem; font-weight: 600; text-align: center;}
          .table th,
          .table td {
            border-top: 0.5px solid #000;
            border-bottom: 0.5px solid #000;
            text-align: right;
            padding: 0.25rem;
            vertical-align: top;
          }

          .table td p {
            margin: 0;
            padding: 0;
            line-height: 1;
          }

          .table td p + p {
            margin-top: 0.2rem;
          }
          .observations-text{
            font-weight: 600;
          }
          .details-text{
            font-weight: 400;
          }
          .table-body{font-size: 0.75rem;}
          .header-div{width: 100%; text-align: center;}
          .title{font-size: 1.5rem; font-weight: 600;}
          .main-container{
            font-family: serif;
            margin: 2rem;
          }`;

        try {
          await fetch(`${env.LAMBDA_API_ENDPOINT}/dev/pdf`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": env.LAMBDA_API_KEY,
            },
            body: JSON.stringify({
              htmlString,
              cssString,
              bucketName: ctx.s3.bucketNames.reports,
              fileKey: `cuentas/${filename}`,
            }),
          });
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: JSON.stringify(e),
          });
        }
      }

      const getCommand = new GetObjectCommand({
        Bucket: ctx.s3.bucketNames.reports,
        Key: `cuentas/${filename}`,
      });

      const downloadUrl = await ctx.s3.getSignedUrl(ctx.s3.client, getCommand, {
        expiresIn: 300,
      });
      return { downloadUrl, filename };
    }),
  detailedBalancesFile: protectedLoggedProcedure
    .input(
      z.object({
        entityId: z.number().int().optional().nullish(),
        entityTag: z.string().optional().nullish(),
        fileType: z.enum(["csv", "pdf"]),
        detailedBalances: z.array(
          z.object({
            entity: z.object({
              id: z.number().int(),
              name: z.string(),
              tagName: z.string(),
            }),
            data: z.array(
              z.object({ currency: z.string(), balance: z.number() }),
            ),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const entities = await getAllEntities(ctx.redis, ctx.db);
      const filename = `saldos_fecha:${moment().format(
        "DD-MM-YYYY-HH:mm:ss",
      )}_entidad:${
        input.entityId
          ? entities.find((e) => e.id === input.entityId)?.name
          : input.entityTag
      }.${input.fileType}`;

      if (input.fileType === "csv") {
        const csvData = input.detailedBalances.map((detailedBalance) => {
          const entity = detailedBalance.entity.name;
          const balances: Record<string, number> = {};

          // Get unified balance but don't add it yet
          const unifiedBalance =
            detailedBalance.data.find(
              (dataItem) => dataItem.currency === "unified",
            )?.balance ?? 0;

          // Add other currencies first
          currenciesOrder.forEach((currency) => {
            balances[currency] =
              Math.round(
                (detailedBalance.data.find(
                  (dataItem) => dataItem.currency === currency,
                )?.balance ?? 0) * 100,
              ) / 100;
          });

          // Add unified balance at the end
          return {
            entidad: entity,
            ...balances,
            unificado: Math.round(unifiedBalance * 100) / 100,
          };
        });
        const csv = unparse(csvData, { delimiter: "," });
        const putCommand = new PutObjectCommand({
          Bucket: ctx.s3.bucketNames.reports,
          Key: `saldos/${filename}`,
          Body: Buffer.from(csv, "utf-8"),
        });

        await ctx.s3.client.send(putCommand);
      } else if (input.fileType === "pdf") {
        const htmlString =
          `<div class="header-div"><h1 class="title">Saldos de ${
            input.entityId
              ? entities.find((e) => e.id === input.entityId)?.name
              : input.entityTag
          }</h1></div>` +
          `
          <div class="table">
          <div class="table-header">
            <p>Entidad</p>
            ${currenciesOrder
              .map((currency) => `<p>${currency.toUpperCase()}</p>`)
              .join("")}
            <p>Unificado</p>
          </div>
          ${input.detailedBalances
            .map((b, index) => {
              // Get unified balance
              const unifiedBalance =
                b.data.find((item) => item.currency === "unified")?.balance ??
                0;

              // Create a map of all currencies with their balances or default to 0
              const currencyMap: Record<string, number> =
                currenciesOrder.reduce(
                  (acc, currency) => {
                    const foundCurrency = b.data.find(
                      (item) => item.currency === currency,
                    );
                    acc[currency] = foundCurrency ? foundCurrency.balance : 0;
                    return acc;
                  },
                  {} as Record<string, number>,
                );

              // Generate the HTML for each row, respecting the currency order
              return `<div key="${index}" class="table-row">
                          <p>${b.entity.name}</p>
                          ${currenciesOrder
                            .map(
                              (currency) =>
                                `<p>${numberFormatter(
                                  currencyMap[currency]!,
                                )}</p>`,
                            )
                            .join("")}
                          <p>${numberFormatter(unifiedBalance)}</p>
                        </div>`;
            })
            .join("")}
          </div>`;

        const cssString = `.table{
            display: grid;
            grid-template-columns:
            repeat(1, 1fr);
            gap: 0.25rem
            }
          .table-row{
          display: grid;
          grid-template-columns: repeat(${currenciesOrder.length + 1}, 1fr);
          gap: 0.1rem;
          border-bottom: 1px solid black;
          padding-bottom: 0.10rem;
          text-align: center;
          font-size: 0.75rem;
          align-items: center;
          }
          .table-header{
          display: grid;
          grid-template-columns: repeat(${currenciesOrder.length + 1}, 1fr);
          gap: 0.25rem;
          border-bottom: 2px solid black;
          padding-bottom: 0.25rem;
          text-align: center;
          font-size: 1rem;
          font-weight: 600;
          align-items: center;
          } .header-div{width: 100%; text-align: center;} .title{font-size: 2rem; font-weight: 600;}`;

        try {
          await fetch(`${env.LAMBDA_API_ENDPOINT}/dev/pdf`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": env.LAMBDA_API_KEY,
            },
            body: JSON.stringify({
              htmlString,
              cssString,
              bucketName: ctx.s3.bucketNames.reports,
              fileKey: `saldos/${filename}`,
            }),
          });
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: JSON.stringify(e),
          });
        }
      }

      const getCommand = new GetObjectCommand({
        Bucket: ctx.s3.bucketNames.reports,
        Key: `saldos/${filename}`,
      });

      const downloadUrl = await ctx.s3.getSignedUrl(ctx.s3.client, getCommand, {
        expiresIn: 300,
      });
      return { downloadUrl, filename };
    }),

  getOperationData: protectedProcedure
    .input(
      getOperationsInput
        .extend({
          fileType: z.enum(["csv", "pdf"]),
          operationsCount: z.number().int(),
        })
        .omit({ page: true, limit: true }),
    )
    .mutation(async ({ ctx, input }) => {
      const { operations } = await getOperationsProcedure(ctx, {
        ...input,
        page: 1,
        limit: input.operationsCount,
      });
      const transactionsToPrint = operations.flatMap((operation) => {
        return operation.transactions.map((transaction) => {
          return {
            id: operation.id,
            txId: transaction.id,
            fecha: moment(operation.date).format("DD-MM-YY HH:mm"),
            tipo: transaction.type,
            operador: transaction.operatorEntity.name,
            origen: transaction.fromEntity.name,
            destino: transaction.toEntity.name,
            detalle: operation.observations,
            divisa: transaction.currency,
            monto: transaction.amount,
            estado: transaction.status,
            cargadoPor: transaction.transactionMetadata.uploadedByUser?.name,
            confirmadoPor:
              transaction.transactionMetadata.confirmedByUser?.name,
          };
        });
      });

      const filename = `transacciones_${moment().format(
        "DD-MM-YYYY-HH:mm:ss",
      )}.${input.fileType}`;

      if (input.fileType === "csv") {
        const csv = unparse(transactionsToPrint, { delimiter: "," });
        const putCommand = new PutObjectCommand({
          Bucket: ctx.s3.bucketNames.reports,
          Key: `transacciones/${filename}`,
          Body: Buffer.from(csv, "utf-8"),
        });

        await ctx.s3.client.send(putCommand);
      } else if (input.fileType === "pdf") {
        const htmlString =
          `<html>
          <body class="main-container">
          <div class="header-div">
            <h1 class="title">Transacciones</h1>
            <h2 class="subtitle">${moment().format("DD-MM-YY HH:mm")}</h2>
          </div>` +
          `
          <div class="table-container">
          <table class="table">
          <thead class="table-header">
            <tr>
            <th>Id</th>
            <th>TxId</th>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Operador</th>
            <th>Origen</th>
            <th>Destino</th>
            <th>Detalle</th>
            <th>Divisa</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Cargado Por</th>
            <th>Confirmado Por</th>
            </tr>
          </thead>
          <tbody class="table-body">
            ${transactionsToPrint
              .map(
                (tx, index) =>
                  `<tr key="${index}">
                <td>${tx.id}</td>
                <td>${tx.txId}</td>
                <td>${tx.fecha}</td>
                <td>${tx.tipo}</td>
                <td>${tx.operador}</td>
                <td>${tx.origen}</td>
                <td>${tx.destino}</td>
                <td>${tx.detalle ?? ""}</td>
                <td>${tx.divisa}</td>
                <td>${numberFormatter(tx.monto)}</td>
                <td>${tx.estado}</td>
                <td>${tx.cargadoPor ?? ""}</td>
                <td>${tx.confirmadoPor ?? ""}</td>
                  </tr>`,
              )
              .join("")}
            </tbody>
            </body>
            </html>`;

        const cssString = `.table-container{margin-top: 0.5rem;}
          .table{width: 100%; border-collapse: collapse;}
          .table-header{font-size: 1rem; font-weight: 600; text-align: center;}
          .table th,
          .table td {
            border-top: 0.5px solid #000;
            border-bottom: 0.5px solid #000;
            text-align: right;
            padding: 0.25rem;
            vertical-align: top;
          }

          .table td p {
            margin: 0;
            padding: 0;
            line-height: 1;
          }

          .table td p + p {
            margin-top: 0.2rem;
          }
          .observations-text{
            font-weight: 600;
          }
          .details-text{
            font-weight: 400;
          }
          .table-body{font-size: 0.75rem;}
          .header-div{width: 100%; text-align: center;}
          .title{font-size: 1.5rem; font-weight: 600;}
          .subtitle{font-size: 1.2rem; font-weight: 400;}
          .main-container{
            font-family: serif;
            margin: 2rem;
          }`;

        try {
          await fetch(`${env.LAMBDA_API_ENDPOINT}/dev/pdf`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": env.LAMBDA_API_KEY,
            },
            body: JSON.stringify({
              htmlString,
              cssString,
              bucketName: ctx.s3.bucketNames.reports,
              fileKey: `transacciones/${filename}`,
            }),
          });
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: JSON.stringify(e),
          });
        }
      }

      const getCommand = new GetObjectCommand({
        Bucket: ctx.s3.bucketNames.reports,
        Key: `transacciones/${filename}`,
      });

      const downloadUrl = await ctx.s3.getSignedUrl(ctx.s3.client, getCommand, {
        expiresIn: 300,
      });
      return { downloadUrl, filename };
    }),
  getExchangeRates: protectedProcedure
    .input(
      z.object({
        fileType: z.enum(["csv", "pdf"]),
        fromDate: z.string().nullish(),
        toDate: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = await ctx.db
        .select()
        .from(exchangeRates)
        .where(
          and(
            input.fromDate
              ? gte(exchangeRates.date, input.fromDate)
              : undefined,
            input.toDate ? lte(exchangeRates.date, input.toDate) : undefined,
          ),
        );

      const filename = `tipos_de_cambio_${moment().format(
        "DD-MM-YYYY-HH:mm:ss",
      )}.${input.fileType}`;

      if (input.fileType === "csv") {
        const csvData = data
          .sort((a, b) => moment(b.date).valueOf() - moment(a.date).valueOf())
          .map((rate) => ({
            Fecha: moment.utc(rate.date, "YYYY-MM-DD").format("DD-MM-YYYY"),
            Divisa: rate.currency.toUpperCase(),
            Cotización: numberFormatter(rate.rate, 4),
          }));

        const csvString = unparse(csvData);

        await ctx.s3.client.send(
          new PutObjectCommand({
            Bucket: ctx.s3.bucketNames.reports,
            Key: `cotizaciones/${filename}`,
            Body: csvString,
            ContentType: "text/csv",
          }),
        );
      } else {
        const grouped = data.reduce(
          (acc: Record<string, Record<string, number>>, curr) => {
            const dateKey = curr.date;
            if (!acc[dateKey]) {
              acc[dateKey] = Object.fromEntries(
                currenciesOrder.map((c) => [c, 0]),
              );
            }
            acc[dateKey]![curr.currency.toLowerCase()] = curr.rate;
            return acc;
          },
          {},
        );

        const htmlString = `
          <html>
          <body class="main-container">
          <div class="header-div">
            <h1 class="title">Tipos de Cambio</h1>
            <h2 class="subtitle">Maika</h2>
          </div>
          <div class="table-container">
          <table class="table">
            <thead class="table-header">
              <tr>
                <th>Fecha</th>
                ${currenciesOrder
                  .filter((c) => c !== "usd")
                  .map((c) => `<th>${c.toUpperCase()}</th>`)
                  .join("")}
              </tr>
            </thead>
            <tbody class="table-body">
              ${Object.entries(grouped)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(
                  ([date, rates]) => `
                <tr>
                  <td>${moment
                    .utc(date, "YYYY-MM-DD")
                    .format("DD-MM-YYYY")}</td>
                  ${currenciesOrder
                    .filter((c) => c !== "usd")
                    .map(
                      (currency) =>
                        `<td>${
                          rates[currency]
                            ? numberFormatter(rates[currency]!, 4)
                            : "-"
                        }</td>`,
                    )
                    .join("")}
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          </div>
          </body>
          </html>
        `;

        const cssString = `
          .table-container{margin-top: 0.5rem;}
          .table{width: 100%; border-collapse: collapse;}
          .table-header{font-size: 1rem; font-weight: 600; text-align: center;}
          .table th,
          .table td {
            border-top: 0.5px solid #000;
            border-bottom: 0.5px solid #000;
            text-align: right;
            padding: 0.25rem;
          }
          .table-body{font-size: 0.75rem;}
          .header-div{width: 100%; text-align: center;}
          .title{font-size: 1.5rem; font-weight: 600;}
          .subtitle{font-size: 1.2rem; font-weight: 400;}
          .main-container{
            font-family: serif;
            margin: 2rem;
          }
        `;

        try {
          await fetch(`${env.LAMBDA_API_ENDPOINT}/dev/pdf`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": env.LAMBDA_API_KEY,
            },
            body: JSON.stringify({
              htmlString,
              cssString,
              bucketName: ctx.s3.bucketNames.reports,
              fileKey: `cotizaciones/${filename}`,
            }),
          });
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: JSON.stringify(e),
          });
        }
      }

      const getCommand = new GetObjectCommand({
        Bucket: ctx.s3.bucketNames.reports,
        Key: `cotizaciones/${filename}`,
      });

      const downloadUrl = await ctx.s3.getSignedUrl(ctx.s3.client, getCommand, {
        expiresIn: 300,
      });

      return { downloadUrl, filename };
    }),
});
