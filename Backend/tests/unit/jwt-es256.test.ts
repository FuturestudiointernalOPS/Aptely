import crypto from "crypto";
import { verifyJwtES256 } from "@/middleware/auth.middleware";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const resolveKey = async (kid: string | undefined) => (kid === "k1" ? publicKey : null);

function sign(
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: "ES256", kid: "k1", typ: "JWT" }
): string {
  const h = Buffer.from(JSON.stringify(header)).toString("base64url");
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.sign("sha256", Buffer.from(`${h}.${p}`), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${h}.${p}.${sig.toString("base64url")}`;
}

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

describe("verifyJwtES256", () => {
  it("accepts a valid token and returns its payload", async () => {
    const payload = await verifyJwtES256(sign({ sub: "user-1", exp: inOneHour() }), resolveKey);
    expect(payload.sub).toBe("user-1");
  });

  it("rejects a token whose payload was tampered with", async () => {
    const [h, , s] = sign({ sub: "user-1", exp: inOneHour() }).split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "attacker", exp: inOneHour() })).toString("base64url");
    await expect(verifyJwtES256(`${h}.${forged}.${s}`, resolveKey)).rejects.toThrow("Invalid JWT signature");
  });

  it("rejects an expired token", async () => {
    const token = sign({ sub: "user-1", exp: Math.floor(Date.now() / 1000) - 10 });
    await expect(verifyJwtES256(token, resolveKey)).rejects.toThrow("Token expired");
  });

  it("rejects an unknown key id and a non-ES256 algorithm", async () => {
    await expect(
      verifyJwtES256(sign({ sub: "u", exp: inOneHour() }, { alg: "ES256", kid: "other" }), resolveKey)
    ).rejects.toThrow("Unknown signing key");
    await expect(
      verifyJwtES256(sign({ sub: "u", exp: inOneHour() }, { alg: "none", kid: "k1" }), resolveKey)
    ).rejects.toThrow("Unsupported JWT algorithm");
  });
});
