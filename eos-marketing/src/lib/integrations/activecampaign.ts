import "server-only";

/**
 * Integración con ActiveCampaign para traer los leads semanales por carrera.
 *
 * Estado: PREPARADA, SIN CONECTAR. El botón "Actualizar desde ActiveCampaign"
 * ya llama a `fetchWeeklyLeadsByCareer`; para activarla falta:
 *   1. Definir las variables de entorno ACTIVECAMPAIGN_API_URL
 *      (p. ej. https://<cuenta>.api-us1.com) y ACTIVECAMPAIGN_API_KEY.
 *   2. Implementar la consulta de abajo según cómo se identifica la carrera
 *      en ActiveCampaign (campo personalizado, etiqueta o lista), y devolver
 *      el conteo de leads creados en la semana indicado por código de carrera.
 */

export type WeeklyLeadsResult = {
  /** Código de carrera (el mismo del módulo) → leads recibidos en la semana. */
  leadsByCode: Record<string, number>;
};

export class ActiveCampaignNotConfiguredError extends Error {
  constructor() {
    super(
      "La conexión con ActiveCampaign todavía no está configurada. " +
        "Mientras tanto puedes ingresar los leads manualmente en la tabla."
    );
  }
}

export function isActiveCampaignConfigured(): boolean {
  return Boolean(process.env.ACTIVECAMPAIGN_API_URL && process.env.ACTIVECAMPAIGN_API_KEY);
}

export async function fetchWeeklyLeadsByCareer(
  weekStart: string,
  weekEnd: string
): Promise<WeeklyLeadsResult> {
  if (!isActiveCampaignConfigured()) {
    throw new ActiveCampaignNotConfiguredError();
  }

  // TODO(ActiveCampaign): consultar contactos creados entre weekStart y weekEnd
  // (GET {API_URL}/api/3/contacts?filters[created_after]=...&filters[created_before]=...
  // con el header "Api-Token"), leer el campo que guarda la carrera y agrupar por código.
  void weekStart;
  void weekEnd;
  throw new Error("La consulta a ActiveCampaign aún no está implementada.");
}
