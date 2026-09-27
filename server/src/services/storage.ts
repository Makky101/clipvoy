import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be configured.`);
  }
  return value;
}

export const storageBucket = requiredEnv("BUCKET");

export const storage = new S3Client({
  region: "auto",
  endpoint: requiredEnv("END_POINT"),
  credentials: {
    accessKeyId: requiredEnv("ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("SECRET_ACCESS_KEY"),
  },
});
