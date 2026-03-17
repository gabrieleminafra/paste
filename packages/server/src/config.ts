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
    },
  },
};

declare module "fastify" {
  interface FastifyInstance {
    config: {
      DATABASE_URL: string;
      PORT: number;
      NODE_ENV: string;
    };
  }
}
