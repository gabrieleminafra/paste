import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyEnvOptions } from "@fastify/env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const envSchema: FastifyEnvOptions = {
  dotenv: { path: path.resolve(__dirname, "../../../.env") },
  schema: {
    type: "object",
    required: ["DATABASE_URL"],
    properties: {
      DATABASE_URL: {
        type: "string",
      },
      PORT: {
        type: "number",
        default: 3000,
      },
      NODE_ENV: {
        type: "string",
        default: "development",
        enum: ["development", "production", "test"],
      },
      UPLOAD_DIR: {
        type: "string",
        default: path.resolve(__dirname, "../../../uploads"),
      },
      LOG_LEVEL: {
        type: "string",
        default: "info",
        enum: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
      },
    },
  },
};

declare module "fastify" {
  interface FastifyInstance {
    config: {
      DATABASE_URL: string;
      PORT: number;
      NODE_ENV: string;
      UPLOAD_DIR: string;
      LOG_LEVEL: string;
    };
  }
}
