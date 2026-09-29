"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieOptions } from "./session";
import { SESSION_COOKIE, signSession } from "./token";

const digest = (v: string) => createHash("sha256").update(v).digest();

export type LoginState = { error: string | null; name: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const password = String(formData.get("password") ?? "");
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return { error: "El acceso no está configurado (falta DASHBOARD_PASSWORD).", name };
  if (!name) return { error: "Escribe tu nombre.", name };
  if (!timingSafeEqual(digest(password), digest(expected))) {
    return { error: "Contraseña incorrecta.", name };
  }

  (await cookies()).set(SESSION_COOKIE, await signSession({ name }), sessionCookieOptions);
  redirect("/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
