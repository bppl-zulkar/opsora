import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const COOKIE_NAME = "opsora_password_recovery";

export type RecoveryChallenge = {
  version: 1;
  userId: string;
  organizationId: string;
  email: string;
  employeeId: string;
  codeHash: string;
  salt: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
};

export function hashRecoveryCode(code: string, salt: string) {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function createRecoveryChallenge(input: {
  userId: string;
  organizationId: string;
  email: string;
  employeeId: string;
  code: string;
}): RecoveryChallenge {
  const salt = randomBytes(24).toString("base64url");
  return {
    version: 1,
    userId: input.userId,
    organizationId: input.organizationId,
    email: input.email,
    employeeId: input.employeeId,
    codeHash: hashRecoveryCode(input.code, salt),
    salt,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    verified: false,
  };
}

export function recoveryCodeMatches(
  challenge: RecoveryChallenge,
  code: string,
) {
  const expected = Buffer.from(challenge.codeHash, "hex");
  const actual = Buffer.from(hashRecoveryCode(code, challenge.salt), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function setRecoveryChallenge(challenge: RecoveryChallenge) {
  (await cookies()).set(
    COOKIE_NAME,
    encryptSecret(JSON.stringify(challenge)),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: Math.max(
        1,
        Math.ceil((challenge.expiresAt - Date.now()) / 1000),
      ),
    },
  );
}

export async function getRecoveryChallenge() {
  const payload = (await cookies()).get(COOKIE_NAME)?.value;
  if (!payload) return null;
  try {
    const parsed = JSON.parse(decryptSecret(payload)) as RecoveryChallenge;
    if (
      parsed.version !== 1 ||
      !parsed.userId ||
      !parsed.organizationId ||
      !parsed.email ||
      parsed.expiresAt <= Date.now()
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearRecoveryChallenge() {
  (await cookies()).delete(COOKIE_NAME);
}
