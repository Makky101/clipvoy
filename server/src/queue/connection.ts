import { Redis } from "ioredis";

let connection: Redis | null = null;

/**
 * A single shared ioredis connection per process. BullMQ requires
 * `maxRetriesPerRequest: null` on any connection used by a Worker/QueueEvents
 * (they rely on blocking commands) - forgetting this is a very common BullMQ
 * footgun, so it's set here once rather than at every call site.
 */
export function getRedisConnection(): Redis {
  if (!connection) {
    const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    connection = new Redis(url, {
      maxRetriesPerRequest: null,
    });

    connection.on("error", (error: Error) => {
      console.error("[redis] Connection error:", error.message);
    });
  }
  return connection;
}
