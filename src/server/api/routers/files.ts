import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { compressPDF } from "ghostscript-node";
import moment from "moment";
import { unparse } from "papaparse";
import { launch } from "puppeteer";
import { z } from "zod";
import { generateTableData, getAllChildrenTags } from "~/lib/functions";
import { getAllTags } from "~/lib/trpcFunctions";
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
            { transaction: { date: { gte: input.toDate } } },
            {
              AND: [
                { transaction: { date: null } },
                { transaction: { operation: { date: { gte: input.toDate } } } },
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

      const filename = `account_fecha:${moment().format(
        "DD-MM-YYYY-HH:mm:ss",
      )}_${input.entityId ? input.entityId : input.entityTag}${
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
          divisa: mv.currency,
          entrada: mv.ingress,
          salida: mv.egress,
          saldo: mv.balance,
        }));

        const getCommand = new GetObjectCommand({
          Bucket: ctx.s3.bucketNames.reports,
          Key: filename,
        });
        if (input.fileType === "csv") {
          const csv = unparse(data, { delimiter: "," });
          const putCommand = new PutObjectCommand({
            Bucket: ctx.s3.bucketNames.reports,
            Key: filename,
            Body: Buffer.from(csv, "utf-8"),
          });

          await ctx.s3.client.send(putCommand);
        } else if (input.fileType === "pdf") {
          const htmlString = `<div class="table">${data
            .map(
              (mv) => `<div key="${mv.saldo}" class="row">${mv.detalle}</div>`,
            )
            .join("")}</div>`;

          const browser = await launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });

          const page = await browser.newPage();
          await page.setContent(htmlString);
          await page.addStyleTag({
            content:
              ".row{font-size: 1.125rem;} .table{display: grid; grid-template-columns: repeat(1, 1fr); gap: 0.75rem;}",
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
            displayHeaderFooter: true,
            headerTemplate: `<div><h1>Cuenta corriente de ${
              input.entityId ? input.entityId : input.entityTag
            }</h1></div>`,
            footerTemplate: ``,
          });
          await browser.close();

          const compressedPdfBuffer = await compressPDF(pdfBuffer);

          const putCommand = new PutObjectCommand({
            Bucket: ctx.s3.bucketNames.reports,
            Key: filename,
            Body: compressedPdfBuffer,
            ContentType: "application/pdf",
          });

          await ctx.s3.client.send(putCommand);
        }

        const downloadUrl = await ctx.s3.getSignedUrl(
          ctx.s3.client,
          getCommand,
          { expiresIn: 300 },
        );
        return { downloadUrl, filename };
      }
    }),
});
