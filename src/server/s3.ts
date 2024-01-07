import {
  GetObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env.mjs";

const client = new S3Client({
  region: "sa-east-1",
  credentials: {
    accessKeyId: env.S3_PUBLIC_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

export const s3 = {
  client: client,
  putObject: PutObjectCommand,
  getObject: GetObjectCommand,
  listObjects: ListObjectsCommand,
  getSignedUrl,
  bucketNames: { reports: "maika-reportes" },
};
