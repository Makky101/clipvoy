import { Redis } from "ioredis";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

let connection: Redis | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * A single shared ioredis connection per process. BullMQ requires
 * `maxRetriesPerRequest: null` on any connection used by a Worker/QueueEvents
 * (they rely on blocking commands) - forgetting this is a very common BullMQ
 * footgun, so it's set here once rather than at every call site.
 */
export function getRedisConnection(): Redis {
  if(!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not set");
  }
  if (!connection) {
    const url = process.env.REDIS_URL;
    connection = new Redis(url, {
      maxRetriesPerRequest: null,
    });

    connection.on("error", (error: Error) => {
      console.error("[redis] Connection error:", error.message);
    });
  }
  return connection;
}
