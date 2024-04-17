import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
import moment from "moment";
import { unparse } from "papaparse";
import { z } from "zod";
import { env } from "~/env.mjs";
import { currentAccountsProcedure, getAllEntities, getAllTags } from "~/lib/trpcFunctions";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";
import { generateTableData, numberFormatter } from "~/lib/functions";

export const filesRouter = createTRPCRouter({
  getCurrentAccount: protectedProcedure
    .input(
      z.object({
        dayInPast: z.string().optional(),
        toEntityId: z.number().int().optional().nullish(),
        fileType: z.enum(["csv", "pdf"]),
        entityId: z.number().nullish(),
        entityTag: z.string().nullish(),
        fromDate: z.date().nullish(),
        toDate: z.date().optional().nullish(),
        account: z.boolean(),
        currency: z.string().optional().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const currentAccount = await currentAccountsProcedure({
        entityTag: input.entityTag,
        entityId: input.entityId,
        currency: input.currency,
        account: input.account,
        fromDate: input.fromDate,
        toDate: input.toDate,
        pageSize: 100000,
        pageNumber: 1,
        dayInPast: input.dayInPast,
        toEntityId: input.toEntityId
      }, ctx)

      const tags = await getAllTags(ctx.redis, ctx.db)

      const tableData = generateTableData(currentAccount.movementsQuery, input.entityId, input.entityTag, tags)

      const data = tableData.map((mv) => ({
        fecha: moment(mv.date, "DD-MM-YYYY HH:mm").format("DD-MM-YYYY"),
        origen: mv.selectedEntity,
        cliente: mv.otherEntity,
        detalle: `${mv.type === "upload"
          ? "Carga"
          : mv.type === "confirmation"
            ? "Confirmación"
            : "Cancelación"
          } de ${mv.txType} - Nro ${mv.id}`,
        observaciones: mv.observations,
        entrada:
          mv.ingress !== 0
            ? mv.currency.toUpperCase() +
            " " +
            numberFormatter(mv.ingress)
            : "",
        salida:
          mv.egress !== 0
            ? mv.currency.toUpperCase() +
            " " +
            numberFormatter(mv.egress)
            : "",
        saldo:
          mv.balance !== 0
            ? mv.currency.toUpperCase() +
            " " +
            numberFormatter(mv.balance)
            : "",
      }));

      const entities = await getAllEntities(ctx.redis, ctx.db);

      const filename = `${input.account ? "cuenta_corriente" : "caja"
        }_fecha:${moment().format("DD-MM-YYYY-HH:mm:ss")}_entidad:${input.entityId
          ? entities.find((e) => e.id === input.entityId)?.name
          : input.entityTag
        }${input.fromDate
          ? `_desde:${moment(input.fromDate).format("DD-MM-YYYY")}`
          : ""
        }${input.toDate
          ? `_hasta:${moment(input.toDate).format("DD-MM-YYYY")}`
          : ""
        }${input.currency ? `_divisa:${input.currency}` : ""}.${input.fileType}`;

      if (input.fileType === "csv") {
        const csv = unparse(data, { delimiter: "," });
        const putCommand = new PutObjectCommand({
          Bucket: ctx.s3.bucketNames.reports,
          Key: `cuentas/${filename}`,
          Body: Buffer.from(csv, "utf-8"),
        });

        await ctx.s3.client.send(putCommand);
      } else if (input.fileType === "pdf") {
        const htmlString =
          `<div class="header-div"><h1 class="title">Cuenta corriente de ${input.entityId
            ? entities.find((e) => e.id === input.entityId)?.name
            : input.entityTag
          } ${input.toEntityId ? "con " + entities.find(e => e.id === input.toEntityId)?.name : ""}</h1></div>` +
          `
          <div class="table">
          <div class="table-header">
            <p>Fecha</p>
            <p>Detalle</p>
            <p>Origen</p>
            ${!input.toEntityId ? (
            "<p>Cliente</p>"
          ) : ""}
            <p>Observaciones</p>
            <p>Entrada</p>
            <p>Salida</p>
            <p>Saldo</p>
          </div>
            ${data
            .map(
              (mv, index) =>
                `<div key="${index}" class="table-row">
                  <p>${mv.fecha}</p>
                  <p>${mv.detalle}</p>
                  <p>${mv.origen}</p>
                  ${!input.toEntityId ? (
                  `<p>${mv.cliente}</p>`
                ) : ""}
                  <p>${mv.observaciones}</p>
                  <p>${mv.entrada}</p>
                  <p>${mv.salida}</p>
                  <p>${mv.saldo}</p>
                  </div>`,
            )
            .join("")}
            </div>`;

        const cssString =
          `.table{display: grid; grid-template-columns: repeat(1, 1fr); gap: 0.25rem} .table-row{display: grid; grid-template-columns: repeat(${input.toEntityId ? "7" : "8"}, 1fr); gap: 0.1rem; border-bottom: 1px solid black; padding-bottom: 0.10rem; text-align: center; font-size: 0.5rem; align-items: center;} .table-header{display: grid; grid-template-columns: repeat(${input.toEntityId ? "7" : "8"}, 1fr); gap: 0.25rem; border-bottom: 2px solid black; padding-bottom: 0.25rem; text-align: center; font-size: 0.75rem; font-weight: 400; align-items: center; background-color: hsl(215.4, 16.3%, 78.9%);} .header-div{width: 100%; text-align: center;} .title{font-size: 1.5rem; font-weight: 600;}`;

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
      )}_entidad:${input.entityId
        ? entities.find((e) => e.id === input.entityId)?.name
        : input.entityTag
        }.${input.fileType}`;

      const formattedBalances = input.detailedBalances.flatMap((balance) => ({
        entidad: balance.entity.name,
        ars: balance.data.find((d) => d.currency === "ars")?.balance ?? 0,
        usd: balance.data.find((d) => d.currency === "usd")?.balance ?? 0,
        usdt: balance.data.find((d) => d.currency === "usdt")?.balance ?? 0,
        eur: balance.data.find((d) => d.currency === "eur")?.balance ?? 0,
        brl: balance.data.find((d) => d.currency === "brl")?.balance ?? 0,
      }));

      if (input.fileType === "csv") {
        const csv = unparse(formattedBalances, { delimiter: "," });
        const putCommand = new PutObjectCommand({
          Bucket: ctx.s3.bucketNames.reports,
          Key: `saldos/${filename}`,
          Body: Buffer.from(csv, "utf-8"),
        });

        await ctx.s3.client.send(putCommand);
      } else if (input.fileType === "pdf") {
        const htmlString =
          `<div class="header-div"><h1 class="title">Saldos de ${input.entityId
            ? entities.find((e) => e.id === input.entityId)?.name
            : input.entityTag
          }</h1></div>` +
          `
          <div class="table">
          <div class="table-header">
            <p>Entidad</p>
            <p>ARS</p>
            <p>USD</p>
            <p>USDT</p>
            <p>EUR</p>
            <p>BRL</p>
          </div>
            ${formattedBalances
            .map(
              (b, index) =>
                `<div key="${index}" class="table-row">
                  <p>${b.entidad}</p>
                  <p>${numberFormatter(b.ars)}</p>
                  <p>${numberFormatter(b.usd)}</p>
                  <p>${numberFormatter(b.usdt)}</p>
                  <p>${numberFormatter(b.eur)}</p>
                  <p>${numberFormatter(b.brl)}</p>
                  </div>`,
            )
            .join("")}
            </div>`;

        const cssString =
          ".table{display: grid; grid-template-columns: repeat(1, 1fr); gap: 0.25rem} .table-row{display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.1rem; border-bottom: 1px solid black; padding-bottom: 0.10rem; text-align: center; font-size: 0.75rem; align-items: center;} .table-header{display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.25rem; border-bottom: 2px solid black; padding-bottom: 0.25rem; text-align: center; font-size: 0.75rem; font-weight: 400; align-items: center; background-color: hsl(215.4, 16.3%, 66.9%);} .header-div{width: 100%; text-align: center;} .title{font-size: 2rem; font-weight: 600;}";

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
});
