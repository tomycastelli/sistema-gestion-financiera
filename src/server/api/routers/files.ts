import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressPDF } from "ghostscript-node";
import moment from "moment";
import { unparse } from "papaparse";
import { launch } from "puppeteer";
import { z } from "zod";
import { generateTableData, getAllChildrenTags } from "~/lib/functions";
import { getAllEntities, getAllTags } from "~/lib/trpcFunctions";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const filesRouter = createTRPCRouter({
  getCurrentAccount: protectedProcedure
    .input(
      z.object({
        entityId: z.number().int().optional().nullish(),
        entityTag: z.string().optional().nullish(),
        fromDate: z.date().optional().nullish(),
        toDate: z.date().optional().nullish(),
        fileType: z.enum(["pdf", "csv"]),
        account: z.boolean(),
        toEntityId: z.number().int().optional().nullish(),
        currency: z.string().optional().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const whereConditions = [];

      whereConditions.push({ account: input.account });

      if (input.entityId) {
        whereConditions.push({
          transaction: {
            currency: input.currency ? input.currency : {},
            OR: [
              {
                fromEntityId: input.entityId,
                toEntityId: input.toEntityId
                  ? input.toEntityId
                  : {
                      not: input.entityId,
                    },
              },
              {
                fromEntityId: input.toEntityId
                  ? input.toEntityId
                  : {
                      not: input.entityId,
                    },
                toEntityId: input.entityId,
              },
            ],
          },
        });
      } else if (input.entityTag) {
        const tags = await getAllTags(ctx.redis, ctx.db);
        const tagAndChildren = getAllChildrenTags(input.entityTag, tags);

        whereConditions.push({
          transaction: {
            currency: input.currency ? input.currency : {},
            OR: [
              {
                AND: [
                  { fromEntity: { tagName: { in: tagAndChildren } } },
                  {
                    toEntity: input.toEntityId
                      ? { id: input.toEntityId }
                      : { tagName: { notIn: tagAndChildren } },
                  },
                ],
              },
              {
                AND: [
                  {
                    fromEntity: input.toEntityId
                      ? { id: input.toEntityId }
                      : { tagName: { notIn: tagAndChildren } },
                  },
                  { toEntity: { tagName: { in: tagAndChildren } } },
                ],
              },
            ],
          },
        });
      }

      if (input.fromDate) {
        whereConditions.push({
          OR: [
            { transaction: { date: { gte: input.fromDate } } },
            {
              AND: [
                { transaction: { date: null } },
                {
                  transaction: { operation: { date: { gte: input.fromDate } } },
                },
              ],
            },
          ],
        });
      }
      if (input.toDate) {
        whereConditions.push({
          OR: [
            { transaction: { date: { lte: input.toDate } } },
            {
              AND: [
                { transaction: { date: null } },
                { transaction: { operation: { date: { lte: input.toDate } } } },
              ],
            },
          ],
        });
      }

      const movements = await ctx.db.movements.findMany({
        where: {
          AND: whereConditions,
        },
        include: {
          transaction: {
            include: {
              operation: {
                select: {
                  id: true,
                  observations: true,
                  date: true,
                },
              },
              transactionMetadata: true,
              fromEntity: true,
              toEntity: true,
            },
          },
        },
        orderBy: [
          { transaction: { date: "desc" } },
          { transaction: { operation: { date: "desc" } } },
          { id: "desc" },
        ],
      });

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
      const formattedMovements = input.entityId
        ? generateTableData(movements, input.entityId, undefined, undefined)
        : input.entityTag
        ? generateTableData(
            movements,
            undefined,
            input.entityTag,
            await getAllTags(ctx.redis, ctx.db),
          )
        : undefined;
      if (formattedMovements) {
        const data = formattedMovements.flatMap((mv) => ({
          fecha: mv.date,
          detalle: `${
            mv.type === "upload"
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
                new Intl.NumberFormat("es-AR").format(mv.ingress)
              : "",
          salida:
            mv.egress !== 0
              ? mv.currency.toUpperCase() +
                " " +
                new Intl.NumberFormat("es-AR").format(mv.egress)
              : "",
          saldo:
            mv.balance !== 0
              ? mv.currency.toUpperCase() +
                " " +
                new Intl.NumberFormat("es-AR").format(mv.balance)
              : "",
        }));

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
            `<div class="header-div"><h1 class="title">Cuenta corriente de ${
              input.entityId
                ? entities.find((e) => e.id === input.entityId)?.name
                : input.entityTag
            }</h1></div>` +
            `
          <div class="table">
          <div class="table-header">
            <p>Fecha</p>
            <p>Detalle</p>
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
                  <p>${mv.observaciones}</p>
                  <p>${mv.entrada}</p>
                  <p>${mv.salida}</p>
                  <p>${mv.saldo}</p>
                  </div>`,
              )
              .join("")}
            </div>`;

          const browser = await launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });

          const page = await browser.newPage();
          await page.setContent(htmlString);
          await page.addStyleTag({
            content:
              ".table{display: grid; grid-template-columns: repeat(1, 1fr); gap: 0.25rem} .table-row{display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.1rem; border-bottom: 2px solid black; padding-bottom: 0.25rem; text-align: center; font-size: 0.75rem; align-items: center;} .table-header{display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.25rem; border-bottom: 2px solid black; padding-bottom: 0.25rem; text-align: center; font-size: 0.75rem; align-items: center; background-color: hsl(215.4, 16.3%, 66.9%);} .header-div{width: 100%; text-align: center;} .title{font-size: 2rem; font-weight: 600;}",
          });
          const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
              left: "0.5cm",
              top: "2cm",
              right: "0.5cm",
              bottom: "2cm",
            },
          });
          await browser.close();

          const compressedPdfBuffer = await compressPDF(pdfBuffer);

          const putCommand = new PutObjectCommand({
            Bucket: ctx.s3.bucketNames.reports,
            Key: `cuentas/${filename}`,
            Body: compressedPdfBuffer,
            ContentType: "application/pdf",
          });

          await ctx.s3.client.send(putCommand);
        }

        const getCommand = new GetObjectCommand({
          Bucket: ctx.s3.bucketNames.reports,
          Key: `cuentas/${filename}`,
        });

        const downloadUrl = await ctx.s3.getSignedUrl(
          ctx.s3.client,
          getCommand,
          { expiresIn: 300 },
        );
        return { downloadUrl, filename };
      }
    }),
  detailedBalancesFile: protectedProcedure
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
                  <p>${b.ars}</p>
                  <p>${b.usd}</p>
                  <p>${b.usdt}</p>
                  <p>${b.eur}</p>
                  <p>${b.brl}</p>
                  </div>`,
              )
              .join("")}
            </div>`;

        const browser = await launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setContent(htmlString);
        await page.addStyleTag({
          content:
            ".table{display: grid; grid-template-columns: repeat(1, 1fr); gap: 0.25rem} .table-row{display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.1rem; border-bottom: 2px solid black; padding-bottom: 0.25rem; text-align: center; font-size: 0.75rem; align-items: center;} .table-header{display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.25rem; border-bottom: 2px solid black; padding-bottom: 0.25rem; text-align: center; font-size: 0.75rem; align-items: center; background-color: hsl(215.4, 16.3%, 66.9%);} .header-div{width: 100%; text-align: center;} .title{font-size: 2rem; font-weight: 600;}",
        });
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: {
            left: "0.5cm",
            top: "2cm",
            right: "0.5cm",
            bottom: "2cm",
          },
        });
        await browser.close();

        const compressedPdfBuffer = await compressPDF(pdfBuffer);

        const putCommand = new PutObjectCommand({
          Bucket: ctx.s3.bucketNames.reports,
          Key: `saldos/${filename}`,
          Body: compressedPdfBuffer,
          ContentType: "application/pdf",
        });

        await ctx.s3.client.send(putCommand);
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
