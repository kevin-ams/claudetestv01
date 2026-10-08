import type { PasoGuia } from "./guia";

/** Contenido de la guía del portal de facultades, por página. */

export function pasosInicio(nombre: string, facultad: string): PasoGuia[] {
  return [
    {
      titulo: `¡Hola, ${nombre.split(" ")[0]}! 👋`,
      texto:
        `Este es el portal de revisión de artes de ${facultad}. Aquí revisas y apruebas las piezas antes de que se publiquen.\n\n` +
        "El recorrido es así:\n1. Entras a una campaña.\n2. Abres cada arte pendiente.\n3. Lo apruebas o pides cambios marcando puntos sobre la imagen.\n\nTe mostramos cada parte en menos de un minuto.",
    },
    {
      objetivo: "campanas",
      titulo: "Campañas",
      texto:
        "Los artes están agrupados por campaña. Entra a una para ver sus artes; así no se mezclan todos a la vez.\n\nLas campañas con artes por revisar aparecen primero.",
    },
    {
      objetivo: "pendientes-campana",
      titulo: "Lo que espera tu revisión",
      texto: "El número amarillo indica cuántos artes de la campaña están pendientes de tu revisión.",
    },
    {
      objetivo: "contadores",
      titulo: "Estado de la campaña",
      texto:
        "• Pendientes: esperan tu revisión.\n• Con cambios: pediste correcciones y Marketing Digital está trabajando en ellas.\n• Aprobados: listos para publicarse.",
    },
    {
      objetivo: "usuario",
      titulo: "Tu nombre queda registrado",
      texto:
        "No necesitas cuenta: entraste con tu nombre y correo. Quedan registrados en cada aprobación o comentario, y a ese correo te avisaremos cuando haya una nueva versión.",
    },
    {
      objetivo: "ayuda",
      titulo: "¿Necesitas ayuda?",
      texto:
        "Desde aquí puedes volver a ver la guía de cada página, o desactivar las guías automáticas si ya conoces el portal.",
    },
  ];
}

export const pasosCampana: PasoGuia[] = [
  {
    objetivo: "migas",
    titulo: "Estás dentro de una campaña",
    texto: "Aquí ves solo los artes de esta campaña. Usa “← Campañas” para volver y elegir otra.",
  },
  {
    objetivo: "filtros",
    titulo: "Filtra los artes",
    texto:
      "Filtra por estado (por ejemplo, solo los pendientes) o por carrera. Los números te dicen cuántos hay en cada estado.",
  },
  {
    objetivo: "arte",
    titulo: "Abre un arte para revisarlo",
    texto:
      "Cada tarjeta muestra una vista previa, la carrera, la versión (v1, v2…), su estado y la fecha de publicación. Haz clic para revisarlo.",
  },
];

export const pasosArte: PasoGuia[] = [
  {
    objetivo: "visor",
    titulo: "Revisa el arte",
    texto:
      "Aquí ves la pieza. En “Visor de Drive” puedes ver el archivo original, y con “Abrir en Google Drive” descargarlo o verlo completo.",
  },
  {
    objetivo: "lienzo",
    titulo: "Marca puntos sobre la imagen",
    texto:
      "Si algo debe cambiar, haz clic justo en ese lugar de la imagen: aparecerá un punto numerado y un cuadro para escribir qué cambiar (por ejemplo, “el logo debe ir en blanco”). Pulsa “Listo” y repite por cada cambio.",
  },
  {
    objetivo: "detalles",
    titulo: "Datos del arte",
    texto: "Campaña, carrera, formato, fecha de publicación y el copy que acompaña la pieza. Revísalos también.",
  },
  {
    objetivo: "comentario",
    titulo: "Comentario general",
    texto: "Para lo que no está en un lugar específico de la imagen (tono del texto, hashtags, fecha…). Es opcional si marcaste puntos.",
  },
  {
    objetivo: "acciones",
    titulo: "Tu decisión",
    texto:
      "• ✓ Aprobar: el arte está listo para publicarse.\n• Solicitar cambios: envía tus puntos y comentario a Marketing Digital.\n• Solo comentar: deja una nota sin aprobar ni pedir cambios.\n\nSi marcaste puntos, primero envíalos con “Solicitar cambios”.",
  },
  {
    objetivo: "versiones",
    titulo: "Versiones",
    texto:
      "Cuando Marketing Digital corrige el arte, aparece una nueva versión (v2, v3…) y te llega un correo. Aquí puedes ver versiones anteriores y sus puntos; los resueltos aparecen con ✓.",
  },
  {
    objetivo: "historial",
    titulo: "Historial",
    texto: "Todo queda registrado: quién aprobó, pidió cambios o comentó, y cuándo.",
  },
];
