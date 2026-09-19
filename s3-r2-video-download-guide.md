# Downloading Video Data from Cloudflare R2 / S3 in TypeScript

This guide outlines how to safely download video data using the AWS SDK v3 for JavaScript/TypeScript without crashing your application's memory.

---

## 1. Node.js Backend Approach (Recommended for Videos)

Because videos are large binary files, **do not** use `transformToByteArray()` or `transformToString()`. Instead, pipe the raw stream directly to your server's filesystem or forward it to an HTTP response.

```typescript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";

const r2 = new S3Client({
  region: "auto",
  endpoint: "https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function downloadVideoToFile(bucket: string, key: string, outputPath: string) {
  const response = await r2.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  // Validate that the Body exists
  if (!response.Body) {
    throw new Error("Response body is undefined.");
  }

  // Cast or convert the SdkStream into a Node.js Readable stream
  const videoStream = response.Body as Readable;

  // Stream data directly to a local file destination to protect server RAM
  await pipeline(videoStream, createWriteStream(outputPath));
  console.log(`Video downloaded successfully to ${outputPath}`);
}
```


## Summary Comparison Matrix

| Environment | Mechanism Used | Data Memory Overhead | Scalability Limit |
| :--- | :--- | :--- | :--- |
| **Node.js Server** | Stream Pipeline (`node:stream/promises`) | **Low** (data is buffered in chunks and written instantly) | Unlimited file sizes |
