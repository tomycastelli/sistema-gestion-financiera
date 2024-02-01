import { connect, connection, model, models, type Document } from "mongoose";
import { env } from "~/env.mjs";

const mongodb = await connect(env.MONGODB_URL, {
  serverApi: { version: "1", strict: true, deprecationErrors: true },
});

export interface LogsDocument extends Document {
  name: string;
  timestamp: Date;
  createdBy: string;
  input: object;
  output: object;
}

const logsSchema = new mongodb.Schema<LogsDocument>({
  name: { type: String, required: true },
  timestamp: { type: Date, required: true },
  createdBy: { type: String, required: true },
  input: { type: Object, required: true },
  output: { type: Object, required: true },
});

export const logs = models.logs || model<LogsDocument>("logs", logsSchema);

connection.on("connected", () => {
  console.log("Mongoose is connected");
});

connection.on("error", (e) => {
  console.error("Mongoose connection error", e);
});
