import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { env } from "~/env.mjs";

const dynamoDBClient = new DynamoDBClient({
  region: "sa-east-1",
  credentials: {
    accessKeyId: env.S3_PUBLIC_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});
const client = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

export const dynamodb = {
  client,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  tableName: env.DYNAMODB_TABLE,
};
