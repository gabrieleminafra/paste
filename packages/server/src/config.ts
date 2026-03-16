import type { FastifyEnvOptions } from "@fastify/env";

export const envSchema: FastifyEnvOptions = {
  dotenv: true,
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
