import { describe, expect, it } from "vitest";
import { verifyToken } from "../auth/jwt";

function makeJwt(header: object, payload: object, signature = "fake_sig"): string {
  const b64 = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64(header)}.${b64(payload)}.${signature}`;
}

describe("verifyToken", () => {
  it("rejects empty or malformed strings", () => {
    expect(verifyToken("").valid).toBe(false);
    expect(verifyToken("not-a-jwt").valid).toBe(false);
    expect(verifyToken("part1.part2").valid).toBe(false);
    expect(verifyToken("a.b.c.d").valid).toBe(false);
  });

  it("rejects token with missing subject claim", () => {
    const token = makeJwt({ alg: "HS256" }, { role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 });
    const res = verifyToken(token);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/subject/i);
  });

  it("rejects expired token", () => {
    const expiredExp = Math.floor(Date.now() / 1000) - 100;
    const token = makeJwt({ alg: "HS256" }, { sub: "admin", exp: expiredExp });
    const res = verifyToken(token);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/expired/i);
  });

  it("accepts valid active token and returns claims", () => {
    const validExp = Math.floor(Date.now() / 1000) + 7200;
    const token = makeJwt({ alg: "HS256" }, { sub: "admin", role: "admin", exp: validExp });
    const res = verifyToken(token);
    expect(res.valid).toBe(true);
    expect(res.claims?.sub).toBe("admin");
    expect(res.claims?.role).toBe("admin");
  });
});
