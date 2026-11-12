import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Client } from "@libsql/client";
import { z } from "zod";

// CLI-only operation; never expose this function through a route or server action.
// Hash with Better Auth's own implementation, not a separate password scheme.
export async function provisionOwner(database: Client, ownerEmail: string, password: string, reset = false) {
  const email = z.email().parse(ownerEmail.trim().toLowerCase());
  if (password.length < 12 || password.length > 128) throw new Error("Password must contain 12–128 characters.");
  const hash = await hashPassword(password);
  const transaction = await database.transaction("write");
  try {
    const existing = (await transaction.execute({ sql: "SELECT id FROM auth_user WHERE lower(email) = ?", args: [email] })).rows[0];
    const userId = existing ? String(existing.id) : randomUUID();
    const credentials = (await transaction.execute({ sql: "SELECT id FROM auth_account WHERE user_id = ? AND provider_id = 'credential'", args: [userId] })).rows;
    if (credentials.length && !reset) throw new Error("Owner already has a password. Use --reset to replace it and revoke sessions.");
    const now = Date.now();
    if (existing) {
      await transaction.execute({ sql: "UPDATE auth_user SET email = ?, email_verified = 1, updated_at = ? WHERE id = ?", args: [email, now, userId] });
    } else {
      await transaction.execute({ sql: "INSERT INTO auth_user (id, name, email, email_verified, created_at, updated_at) VALUES (?, 'Owner', ?, 1, ?, ?)", args: [userId, email, now, now] });
    }
    // Replace credentials atomically, remove obsolete OAuth tokens, and invalidate
    // every previous session. The configured owner is approved by the administrator.
    await transaction.execute({ sql: "DELETE FROM auth_account WHERE user_id = ?", args: [userId] });
    await transaction.execute({
      sql: "INSERT INTO auth_account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, 'credential', ?, ?, ?, ?)",
      args: [randomUUID(), userId, userId, hash, now, now]
    });
    await transaction.execute({ sql: "DELETE FROM auth_session WHERE user_id = ?", args: [userId] });
    await transaction.commit();
    return userId;
  } finally { transaction.close(); }
}
