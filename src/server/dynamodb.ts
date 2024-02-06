import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import AWS from "aws-sdk";
import { env } from "~/env.mjs";

AWS.config.update({
  accessKeyId: env.S3_PUBLIC_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  region: "sa-east-1",
});

const dynamoDBClient = new DynamoDBClient({ region: "sa-east-1" });
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
  tableName: "sistema-maika",
};
