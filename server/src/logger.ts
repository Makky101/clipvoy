import { Logger } from "tslog";
import fs from "fs";
import path from "path";

const logDir = path.join(process.cwd(), "logs");

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const errorStream = fs.createWriteStream(
    path.join(logDir, "errors.log"),
    { flags: "a" }
);

export const logger = new Logger({
    name: "App",
    minLevel: 0,
});

// Normal console logging
export function logInfo(message: string) {
    logger.info(message);
}

// Error logging
export function logError(message: string, error?: unknown) {
    logger.error(message, error);

    const timestamp = new Date().toISOString();

    errorStream.write(
        `[${timestamp}] ${message}${error ? ` ${error instanceof Error ? error.stack : String(error)}` : ""
        }\n`
    );
}