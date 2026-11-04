import "server-only";

import { connect, type Connection } from "@tursodatabase/serverless";

let connection: Connection | undefined;

export function getTursoConnection(): Connection {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url || !authToken) {
    throw new Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in the frontend environment.",
    );
  }

  connection ??= connect({ url, authToken });
  return connection;
}
