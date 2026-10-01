/**
 * Saludo del Dashboard: cambia según la hora (zona del equipo) y rota entre
 * varias opciones en cada visita.
 */
const BY_TIME: { from: number; to: number; salute: string; phrases: string[] }[] = [
  {
    from: 5,
    to: 11,
    salute: "Buenos días",
    phrases: [
      "¡Hola! ¿Qué vamos a crear hoy?",
      "Nuevo día, nuevas ideas. ¿Empezamos?",
      "Hoy puede salir algo increíble. Vamos a hacerlo realidad.",
      "Café listo. Ideas listas. ¿Tú estás listo?",
      "Hola, ¿cafesito y comenzamos a crear?",
    ],
  },
  {
    from: 12,
    to: 18,
    salute: "Buenas tardes",
    phrases: [
      "Hola, ¿ya tomaste tu cafesito vespertino?",
      "¡Hola! ¿Qué vamos a crear hoy?",
      "Hoy puede salir algo increíble. Vamos a hacerlo realidad.",
    ],
  },
  {
    from: 19,
    to: 21,
    salute: "Buenas noches",
    phrases: ["¡Hola! ¿Qué vamos a crear hoy?", "Hoy puede salir algo increíble. Vamos a hacerlo realidad."],
  },
  { from: 22, to: 28, salute: "Buenas noches", phrases: ["Hola, ¿trasnochando?"] },
];

export function greetingFor(name: string, date = new Date()): { salute: string; phrase: string } {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: process.env.EOS_TIMEZONE || "America/Guatemala",
    }).format(date)
  );
  const h = hour < 5 ? hour + 24 : hour; // la madrugada cuenta como "noche"
  const slot = BY_TIME.find((s) => h >= s.from && h <= s.to) ?? BY_TIME[0];
  const phrase = slot.phrases[Math.floor(Math.random() * slot.phrases.length)];
  return { salute: `${slot.salute}, ${name}`, phrase };
}
