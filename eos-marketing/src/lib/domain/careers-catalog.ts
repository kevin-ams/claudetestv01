import type { CareerLevel } from "./types";

/** Equipo de marketing con el que se inicializa el sistema. */
export const MARKETING_ROSTER = ["Kevin", "Lucero", "Luis", "Andrea", "Patty", "Miguel"] as const;

export type RosterName = (typeof MARKETING_ROSTER)[number];

type CatalogRow = [program: string, code: string, name: string, level: CareerLevel, owner: RosterName];

/**
 * Carreras y responsables tal como vienen de la hoja del equipo.
 * Las metas semanales arrancan en 0 y se definen desde el módulo.
 */
export const CAREER_CATALOG: CatalogRow[] = [
  ["IIO", "PIN", "Maestría en Inteligencia y Análisis de Negocios / Maestría en Business Intelligence and Analytics", "Postgrado", "Luis"],
  ["IIO", "PAPD", "Maestría en Data Science", "Postgrado", "Luis"],
  ["IIO", "PIO", "Maestría en Inteligencia y Análisis de Negocios / Maestría en Business Intelligence and Analytics", "Postgrado", "Luis"],
  ["IIO", "PAO", "Maestría en Data Science", "Postgrado", "Luis"],

  ["FISICC", "II", "Ingeniería de Sistemas, Informática y Ciencias de la Computación", "Pregrado", "Lucero"],
  ["FISICC", "IE", "Ingeniería en Electrónica", "Pregrado", "Lucero"],
  ["FISICC", "IME", "Ingeniería en Mecatrónica", "Pregrado", "Lucero"],
  ["FISICC", "ITR", "Ingeniería en Telecomunicaciones y Redes", "Pregrado", "Lucero"],
  ["FISICC", "IL", "Licenciatura en Administración de Sistemas Informáticos", "Pregrado", "Luis"],
  ["FISICC", "PACI", "Postgrado en Automatización y Control Industrial", "Postgrado", "Lucero"],
  ["FISICC", "PDAE", "Posgrado en Desarrollo de Aplicaciones Electrónicas", "Postgrado", "Lucero"],
  ["FISICC", "PGP", "Postgrado en Gerencia de Proyectos", "Postgrado", "Luis"],
  ["FISICC", "PGC", "Postgrado en Gerencia del Cambio", "Postgrado", "Luis"],
  ["FISICC", "PAS", "Postgrado en Auditoría de Sistemas", "Postgrado", "Luis"],
  ["FISICC", "PSIN", "Postgrado en Sistemas de Información", "Postgrado", "Luis"],
  ["FISICC", "PBD", "Postgrado en Bases de Datos", "Postgrado", "Luis"],
  ["FISICC", "", "3 Postgrados (Melvin especiales)", "Postgrado", "Luis"],
  ["FISICC", "PRC", "Postgrado en Redes de Computadoras", "Postgrado", "Patty"],
  ["FISICC", "PTE", "Postgrado en Gerencia de Telecomunicaciones", "Postgrado", "Patty"],
  ["FISICC", "PSI", "Postgrado en Seguridad Informática", "Postgrado", "Patty"],
  ["FISICC", "PGAI", "Postgrado en Gerencia del Aseguramiento de la Información", "Postgrado", "Patty"],
  ["FISICC", "MCS", "Maestría en Ciberseguridad", "Postgrado", "Patty"],
  ["FISICC", "PEIT", "Postgrado en Emprendimiento e Innovación Tecnológica", "Postgrado", "Lucero"],
  ["FISICC", "DITEC", "Diplomado Industrial en Tecnología", "Pregrado", "Lucero"],
  ["FISICC", "PIA", "Postgrado en Inteligencia Artificial", "Postgrado", "Lucero"],
  ["FISICC", "PDDS", "Postgrado en Diseño y Desarrollo de Software", "Postgrado", "Lucero"],

  ["IIB", "MIB", "Maestría en Ingeniería Biomédica", "Postgrado", "Patty"],

  ["IRE", "ISE", "Ingeniería de Sistemas Energéticos", "Pregrado", "Patty"],
  ["IRE", "LGEA", "Licenciatura en Gestión de la Energía y Ambiente", "Pregrado", "Patty"],
  ["IRE", "TDES", "Técnico en Diseño e Instalación de Sistemas de Energía Solar, Térmica y Fotovoltaica", "Pregrado", "Patty"],
  ["IRE", "MNGE", "Maestría en Negocios y Gestión de la Energía", "Postgrado", "Patty"],
  ["IRE", "PSER", "Postgrado en Sostenibilidad Ambiente y Energía Renovable", "Postgrado", "Patty"],
  ["IRE", "PEE", "Postgrado en Eficiencia Energética", "Postgrado", "Patty"],
  ["IRE", "MER", "Maestría en Energía Renovable", "Postgrado", "Patty"],

  ["FADMOS", "MINE", "MINE (sin nombre en la hoja)", "Postgrado", "Patty"],
  ["FADMOS", "MDGF", "Maestría en Dirección y Gestión Financiera", "Postgrado", "Patty"],
  ["FADMOS", "LMER", "Licenciatura en Mercadeo", "Pregrado", "Lucero"],
  ["FADMOS", "LADMOS", "Licenciatura en Administración de Empresas", "Pregrado", "Lucero"],

  ["FACOM", "LCD", "Licenciatura en Comunicación y Diseño (Sede Central)", "Pregrado", "Lucero"],

  ["ESEC", "DRCW", "Diplomado en Cisco CCNA", "Pregrado", "Patty"],
  ["ESEC", "", "Maestría en Derecho", "Postgrado", "Lucero"],

  ["FACTI", "TGF", "Técnico en Gestión de Centros Fitness y Entrenamiento Físico", "Pregrado", "Lucero"],
  ["FACTI", "LGNS5", "Licenciatura en Gestión de Negocios y Servicios", "Pregrado", "Lucero"],
  ["FACTI", "LACOMT", "Licenciatura en Administración Aduanera y Comercio Internacional", "Pregrado", "Lucero"],
  ["FACTI", "IU", "Ingeniería Industrial", "Pregrado", "Lucero"],
  ["FACTI", "IAD", "Ingeniería Administrativa", "Pregrado", "Lucero"],
  ["FACTI", "MDTE5", "Maestría en Derecho Tributario Empresarial", "Postgrado", "Andrea"],
  ["FACTI", "MPCA", "Maestría en Productividad en Ciencias Agrícolas", "Postgrado", "Andrea"],
  ["FACTI", "MCIA5", "Maestría en Gerencia de Comercio Internacional y Aduanas", "Postgrado", "Andrea"],
  ["FACTI", "MRHQ", "Maestría en Gestión y Desarrollo del Recurso Humano", "Postgrado", "Andrea"],
  ["FACTI", "MAN5", "Maestría en Administración de Negocios", "Postgrado", "Andrea"],
  ["FACTI", "MAF5", "Maestría en Administración Financiera", "Postgrado", "Andrea"],
  ["FACTI", "MR", "Maestría en Reingeniería y Tecnologías del Aseguramiento", "Postgrado", "Andrea"],
  ["FACTI", "MADM", "Maestría en Administración con Especialización en Mercadeo", "Postgrado", "Andrea"],
  ["FACTI", "MIY", "Maestría en Administración de la Calidad", "Postgrado", "Andrea"],
  ["FACTI", "PI", "Postgrado en Ingeniería de Negocios", "Postgrado", "Andrea"],

  ["FABIQ", "INQ", "Ingeniería Química", "Pregrado", "Luis"],
  ["FABIQ", "LAN", "Licenciatura en Alimentación y Nutrición", "Pregrado", "Luis"],
  ["FABIQ", "LQF", "Licenciatura en Química Farmacéutica con Especialidad en Industria y Atención Farmacéutica", "Pregrado", "Luis"],
  ["FABIQ", "LAC", "Licenciatura en Administración de la Calidad Total y Productividad", "Pregrado", "Luis"],
  ["FABIQ", "MAH", "Maestría en Administración Hospitalaria", "Postgrado", "Luis"],
  ["FABIQ", "MBM", "Maestría en Biología Molecular", "Postgrado", "Luis"],
  ["FABIQ", "MNDH", "Maestría en Nutrición y Desarrollo Humano", "Postgrado", "Luis"],
  ["FABIQ", "MPCS", "Maestría en Productividad en Ciencias de la Salud", "Postgrado", "Luis"],
  ["FABIQ", "TEHSB", "Técnico en Enfoque Holístico de la Salud y el Bienestar", "Técnico", "Luis"],

  ["IDEA", "LITAR", "Licenciatura en Tecnología, Administración y Desarrollo de Recursos Humanos", "Pregrado", "Luis"],
  ["IDEA", "LITAE", "Licenciatura en Tecnología y Administración de Empresas", "Pregrado", "Luis"],
  ["IDEA", "LITAH", "Licenciatura en Tecnología y Administración de Empresas Turísticas y Hoteleras", "Pregrado", "Luis"],
  ["IDEA", "LITAM", "Licenciatura en Tecnología y Administración de la Mercadotecnia", "Pregrado", "Luis"],
  ["IDEA", "LITAT", "Licenciatura en Tecnología y Administración de las Telecomunicaciones", "Pregrado", "Luis"],

  ["ESUDRI", "LDRI", "Licenciatura en Diplomacia y Relaciones Internacionales", "Pregrado", "Patty"],
  ["ESUDRI", "MRIP", "Maestría en Diplomacia y Relaciones Internacionales e Imagen Pública", "Postgrado", "Patty"],

  ["ESTEC", "LEA", "Licenciatura en Administración de Empresas Automotriz", "Pregrado", "Lucero"],
  ["ESTEC", "LIAE", "Licenciatura en Informática y Administración Aeronáutica", "Pregrado", "Lucero"],
  ["ESTEC", "LAMV", "Licenciatura en Administración de Empresas con énfasis en Mercadeo y Ventas", "Pregrado", "Lucero"],
  ["ESTEC", "LSAPC", "Licenciatura en Administración de la Calidad", "Pregrado", "Kevin"],
  ["ESTEC", "LSEI", "Licenciatura en Supervisión Eléctrica y Electrónica Industrial", "Pregrado", "Kevin"],
  ["ESTEC", "LDDH", "Licenciatura en Deporte y Desarrollo Humano", "Pregrado", "Kevin"],
  ["ESTEC", "TLI", "Técnico Universitario en Electrónica Industrial", "Técnico", "Kevin"],
  ["ESTEC", "TI", "Técnico Universitario en Supervisión Industrial", "Técnico", "Kevin"],
  ["ESTEC", "TE", "Técnico Universitario en Supervisión Eléctrica", "Técnico", "Kevin"],
  ["ESTEC", "TER", "Técnico Universitario en Supervisión de Equipos de Refrigeración y Aire Acondicionado", "Técnico", "Kevin"],
  ["ESTEC (FICON)", "", "Ingeniería en la Construcción", "Pregrado", "Lucero"],

  ["IVN", "TDS", "Técnico en Desarrollo de Software", "Técnico", "Kevin"],
  ["IVN", "MDELRN", "Maestría en Dirección y Producción de e-Learning", "Postgrado", "Kevin"],

  ["APA", "MADR", "Maestría en Administración del Recurso Humano", "Postgrado", "Andrea"],
  ["APA", "DTA", "Técnico en Informática y Administración de Negocios", "Técnico", "Andrea"],

  ["IES", "DSP", "Diplomado en Seguridad Privada", "Diplomado", "Andrea"],
  ["IES", "LSI", "Licenciatura en Administración de la Seguridad Integral", "Pregrado", "Andrea"],
  ["IES", "MSP", "Maestría en Seguridad Pública", "Postgrado", "Andrea"],
  ["IES", "MCRN", "Maestría en Criminología y Criminalística", "Postgrado", "Andrea"],

  ["IDS", "DRDS", "Doctorado en Desarrollo Sostenible", "Postgrado", "Kevin"],
  ["IDS", "MEPDS", "Maestría en Estrategias Público-Privadas de Desarrollo Sostenible", "Postgrado", "Kevin"],

  ["ESEC", "DBD", "Diplomado en Base de Datos", "Diplomado", "Kevin"],
  ["ESEC", "DRC", "Diplomado en Redes Cisco CCNA", "Diplomado", "Kevin"],
  ["ESEC", "DDPW", "Diplomado en Diseño de Páginas Web", "Diplomado", "Kevin"],
  ["ESEC", "DVS", "Diplomado en Programación", "Diplomado", "Kevin"],
  ["ESEC", "LMF", "Licenciatura en Administración y Microfinanzas", "Pregrado", "Kevin"],
  ["ESEC", "TF", "Licenciatura en Administración y Seguros", "Pregrado", "Kevin"],
  ["ESEC", "LICOMU", "Licenciatura en Administración y Comercialización", "Pregrado", "Kevin"],
  ["ESEC", "LIE", "Licenciatura en Innovación Educativa", "Pregrado", "Kevin"],
  ["ESEC", "MCAA", "Maestría en Ciencias Actuariales Aplicadas", "Postgrado", "Andrea"],
  ["ESEC", "MMD", "Maestría en Marketing Digital", "Postgrado", "Andrea"],
  ["ESEC", "MAINE", "Maestría en Innovación Educativa", "Postgrado", "Andrea"],
  ["ESEC", "MSF", "Maestría en Seguros", "Postgrado", "Andrea"],
  ["ESEC", "MN", "Maestría en Negocios Electrónicos", "Postgrado", "Andrea"],
  ["ESEC", "MIE", "Maestría en Innovación Empresarial", "Postgrado", "Andrea"],
  ["ESEC", "MTD", "Maestría en Transformación Digital", "Postgrado", "Andrea"],
  ["ESEC", "MDPC", "Maestría en Derecho Procesal Constitucional", "Postgrado", "Andrea"],

  ["FACED", "MPP", "Maestría en Psicopedagogía", "Postgrado", "Patty"],
  ["FACED", "MPGE", "Maestría en Planeamiento y Gerencia Educativa", "Postgrado", "Patty"],
  ["FACED", "LPP", "Licenciatura en Psicopedagogía", "Pregrado", "Andrea"],
  ["FACED", "LPRE", "Licenciatura en Educación Inicial y Pre-Primaria", "Pregrado", "Andrea"],
  ["FACED", "PEM", "Profesorado en Enseñanza Media con Especialización", "Pregrado", "Andrea"],
  ["FACED", "LEMF", "Licenciatura en Educación de la Matemática y la Física", "Pregrado", "Andrea"],
  ["FACED", "MADE", "Maestría en Dirección y Gestión Estratégica de Empresas Turísticas", "Postgrado", "Patty"],
  ["FACED", "LEICC", "Licenciatura en Educación de la Informática y Ciencias de la Computación", "Pregrado", "Andrea"],
];
