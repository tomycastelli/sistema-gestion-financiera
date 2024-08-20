import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
import moment from "moment";
import { unparse } from "papaparse";
import { z } from "zod";
import { env } from "~/env.mjs";
import { currentAccountsProcedure, getAllEntities } from "~/lib/trpcFunctions";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";
import { numberFormatter } from "~/lib/functions";
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

      const entities = await getAllEntities(ctx.redis, ctx.db);

      const filename = `${
        input.account ? "cuenta_corriente" : "caja"
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
        const csv = unparse(data, { delimiter: "," });
        const putCommand = new PutObjectCommand({
          Bucket: ctx.s3.bucketNames.reports,
          Key: `cuentas/${filename}`,
          Body: Buffer.from(csv, "utf-8"),
        });

        await ctx.s3.client.send(putCommand);
      } else if (input.fileType === "pdf") {
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
                    <p>${mv.detalle}</p>
                    <p class="observations-text">${mv.observaciones}</p>
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
          border-bottom: 0.5px solid #000
          padding: 0.75rem;
          text-align: right
          }
          .observations-text{
            font-size: 0.75rem;
            font-weight: 200;
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
          `<div class="header-div"><h1 class="title">Saldos de ${
            input.entityId
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
          ".table{display: grid; grid-template-columns: repeat(1, 1fr); gap: 0.25rem} .table-row{display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.1rem; border-bottom: 1px solid black; padding-bottom: 0.10rem; text-align: center; font-size: 0.75rem; align-items: center;} .table-header{display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.25rem; border-bottom: 2px solid black; padding-bottom: 0.25rem; text-align: center; font-size: 1rem; font-weight: 600; align-items: center;} .header-div{width: 100%; text-align: center;} .title{font-size: 2rem; font-weight: 600;}";

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
