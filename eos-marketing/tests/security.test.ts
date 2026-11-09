/** Seguridad (ISO 27001 / OWASP ASVS): configuración, contraseñas, intentos, doble factor, bitácora, archivos y CSV. */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { config, configReport, ConfigError } from "@/lib/config/server";
import { passwordProblem } from "@/lib/auth/password-policy";
import { decrypt, encrypt } from "@/lib/security/crypto";
import { clearFailures, isLocked, MAX_PER_EMAIL, recordAttempt } from "@/lib/security/attempts";
import { confirmEnrollment, currentCodeForTests, disableMfa, getMfaMode, mfaStatus, setMfaMode, startEnrollment, verifyMfa } from "@/lib/security/mfa";
import { listSecurityEvents, recordSecurityEvent } from "@/lib/security/events";
import { purgeExpiredData } from "@/lib/security/retention";
import { accessReview } from "@/lib/security/access-review";
import { sniffImage } from "@/lib/domain/announcements";
import { csvCell } from "@/lib/csv";
import { demoOrg, person, realTeam } from "./helpers";

const env = process.env as Record<string, string | undefined>;
let team: number, user: number, userEmail: string;

beforeAll(async () => {
  team = (await realTeam("Equipo Seguridad")).id;
  const u = await person(team);
  user = u.id;
  userEmail = u.email;
});

describe("configuración (8.9)", () => {
  const saved = { NODE_ENV: env.NODE_ENV, AUTH_SECRET: env.AUTH_SECRET };
  afterEach(() => {
    env.NODE_ENV = saved.NODE_ENV;
    env.AUTH_SECRET = saved.AUTH_SECRET;
  });

  it("en producción no hay clave de sesión por omisión (falla segura)", () => {
    env.NODE_ENV = "production";
    delete env.AUTH_SECRET;
    expect(() => config.auth.secret()).toThrow(ConfigError);
    env.AUTH_SECRET = "una-clave-larga-de-prueba-con-mas-de-32-caracteres";
    expect(config.auth.secret()).toBe(env.AUTH_SECRET);
  });

  it("en desarrollo usa una clave local de prueba", () => {
    env.NODE_ENV = "development";
    delete env.AUTH_SECRET;
    expect(config.auth.secret()).toMatch(/dev-only/);
  });

  it("el reporte de Diagnóstico nunca incluye valores", () => {
    env.AUTH_SECRET = "valor-super-secreto-que-no-debe-aparecer-123456";
    env.ANTHROPIC_API_KEY = "sk-ant-valor-que-no-debe-aparecer";
    const text = JSON.stringify(configReport());
    expect(text).not.toContain("valor-super-secreto");
    expect(text).not.toContain("sk-ant-valor");
    expect(configReport().find((c) => c.name === "AUTH_SECRET")?.status).toBe("ok");
    delete env.ANTHROPIC_API_KEY;
  });
});

describe("contraseñas (5.17)", () => {
  it("exige largo, rechaza las comunes y las que contienen el correo", () => {
    expect(passwordProblem("corta")).toMatch(/al menos 10/);
    expect(passwordProblem("1234567890")).toMatch(/común/);
    expect(passwordProblem("kevinmarketing2026", "kevin@empresa.com")).toMatch(/correo/);
    expect(passwordProblem("una frase larga y segura")).toBeNull();
  });
});

describe("cifrado (8.24)", () => {
  it("cifra y descifra, y detecta alteraciones", () => {
    const sealed = encrypt("JBSWY3DPEHPK3PXP", "totp");
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decrypt(sealed, "totp")).toBe("JBSWY3DPEHPK3PXP");
    expect(decrypt(sealed, "otro-uso")).toBeNull();
    expect(decrypt(sealed.slice(0, -2) + "xx", "totp")).toBeNull();
  });
});

describe("límite de intentos (8.5)", () => {
  it("bloquea tras 5 fallos por correo y se limpia al entrar bien", async () => {
    const email = "fuerza-bruta@test.local";
    let lockedNow = false;
    for (let i = 0; i < MAX_PER_EMAIL; i++) lockedNow = await recordAttempt("password", email, "10.0.0.1", false);
    expect(lockedNow).toBe(true);
    expect(await isLocked("password", email, "10.0.0.9")).toBe(true);
    expect(await isLocked("password", "otra@test.local", "10.0.0.9")).toBe(false);
    await clearFailures("password", email);
    expect(await isLocked("password", email, "10.0.0.9")).toBe(false);
  });
});

describe("doble factor (8.5)", () => {
  it("lo ofrece la organización, se activa con un código y acepta códigos de recuperación una sola vez", async () => {
    expect(await getMfaMode(team)).toBe("off");
    await setMfaMode(team, "optional");
    expect(await getMfaMode(team)).toBe("optional");

    await startEnrollment(user, userEmail);
    const pending = (await db().sql`SELECT totp_pending_secret FROM users WHERE id = ${user}`)[0].totp_pending_secret as string;
    const secret = decrypt(pending, "totp")!;
    expect(await confirmEnrollment(user, "000000")).toBeNull();
    const codes = (await confirmEnrollment(user, currentCodeForTests(secret)))!;
    expect(codes).toHaveLength(10);
    expect((await mfaStatus(user)).enabled).toBe(true);

    // El secreto queda cifrado en la base.
    const stored = (await db().sql`SELECT totp_secret FROM users WHERE id = ${user}`)[0].totp_secret as string;
    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain(secret);

    expect(await verifyMfa(user, currentCodeForTests(secret))).toBe("totp");
    expect(await verifyMfa(user, "123")).toBeNull();
    expect(await verifyMfa(user, codes[0].toUpperCase())).toBe("recovery");
    expect(await verifyMfa(user, codes[0])).toBeNull(); // un solo uso
    expect((await mfaStatus(user)).recoveryLeft).toBe(9);

    await disableMfa(user);
    expect((await mfaStatus(user)).enabled).toBe(false);
  });
});

describe("bitácora de seguridad (8.15)", () => {
  it("registra eventos que no se pueden modificar ni borrar antes de un año", async () => {
    await recordSecurityEvent({ type: "login_failed", userId: user, teamId: team, email: userEmail, ip: "10.1.1.1" });
    const events = await listSecurityEvents(team);
    expect(events[0]).toMatchObject({ type: "login_failed", ip: "10.1.1.1" });
    await expect(db().sql`UPDATE security_events SET detail = 'cambiado' WHERE id = ${events[0].id}`).rejects.toThrow();
    await expect(db().sql`DELETE FROM security_events WHERE id = ${events[0].id}`).rejects.toThrow();
    // La retención sí puede borrar lo que pasa de un año.
    expect(await purgeExpiredData()).toHaveProperty("security_events");
  });

  it("una organización no ve la bitácora ni los accesos de otra", async () => {
    const other = await demoOrg("Org ajena seguridad");
    await recordSecurityEvent({ type: "login_ok", userId: other.owner.id, teamId: other.team.id, email: other.owner.email, ip: null });
    expect((await listSecurityEvents(team)).some((e) => e.email === other.owner.email.toLowerCase())).toBe(false);
    expect((await accessReview(team)).some((r) => r.user_id === other.owner.id)).toBe(false);
    expect((await accessReview(team)).some((r) => r.user_id === user)).toBe(true);
  });
});

describe("entradas peligrosas (8.7, ASVS 5.x)", () => {
  it("las imágenes se reconocen por su contenido, no por el nombre", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    expect(sniffImage(png)).toBe("image/png");
    expect(sniffImage(html)).toBeNull();
  });

  it("el CSV neutraliza fórmulas en textos que vienen de afuera", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+502 5555")).toBe("'+502 5555");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("Ana, Pérez")).toBe('"Ana, Pérez"');
  });
});
