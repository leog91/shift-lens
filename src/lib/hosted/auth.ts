import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/libsql";
import { hostedDatabase } from "./database";
import { hostedConfig } from "./config";
import * as schema from "./auth-schema";

let auth: ReturnType<typeof createAuth> | undefined;
function createAuth() {
  const config = hostedConfig();
  return betterAuth({
    appName: "ShiftLens", baseURL: config.baseURL, secret: config.secret,
    database: drizzleAdapter(drizzle(hostedDatabase(), { schema }), { provider: "sqlite", schema, transaction: true }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    session: { expiresIn: 60 * 60 * 24, updateAge: 60 * 60, cookieCache: { enabled: false } },
    trustedOrigins: [config.baseURL],
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30,
      customRules: { "/sign-in/email": { window: 60, max: 5 } } },
    databaseHooks: {
      user: { create: { before: async () => {
        // Accounts are provisioned by a trusted CLI, never through a web request.
        throw new APIError("FORBIDDEN", { message: "Account creation is disabled." });
      } } }
    }
  });
}
export function hostedAuth() { return auth ??= createAuth(); }

// Authorization is checked again on every read, independently of route protection.
export async function authorizedCompany(requestHeaders: Headers) {
  const config = hostedConfig();
  const session = await hostedAuth().api.getSession({ headers: requestHeaders });
  if (!session || !session.user.emailVerified || session.user.email.toLowerCase() !== config.ownerEmail) return null;
  return config.companyId;
}
