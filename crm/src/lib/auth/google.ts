import "server-only";

// Inicio de sesión con Google restringido al dominio de Workspace de Ams Studio.
// Los scopes de Gmail se agregan en la fase de integración de correo.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const OAUTH_STATE_COOKIE = "ams_crm_oauth_state";

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  hd?: string;
};

export function allowedDomain() {
  return (process.env.ALLOWED_DOMAIN || "amscreativeint.com").toLowerCase();
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(origin: string) {
  return `${origin}/api/auth/google/callback`;
}

export function buildAuthUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    hd: allowedDomain(),
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCodeForProfile(
  origin: string,
  code: string
): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google rechazó el código (${tokenRes.status})`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!profileRes.ok) {
    throw new Error(`No se pudo leer el perfil de Google (${profileRes.status})`);
  }
  return (await profileRes.json()) as GoogleProfile;
}

// El parámetro `hd` de la URL solo sugiere la cuenta; la verificación real es esta.
export function isAllowedProfile(profile: GoogleProfile) {
  const domain = allowedDomain();
  return (
    profile.email_verified &&
    profile.hd?.toLowerCase() === domain &&
    profile.email.toLowerCase().endsWith(`@${domain}`)
  );
}
