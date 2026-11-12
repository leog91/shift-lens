import { createClient, type Client } from "@libsql/client";
import { hostedConfig } from "./config";

let client: Client | undefined;
export function hostedDatabase() {
  const config = hostedConfig();
  return client ??= createClient({ url: config.url, authToken: config.authToken });
}
