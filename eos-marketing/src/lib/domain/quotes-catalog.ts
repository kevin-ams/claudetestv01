// Banco inicial de frases motivacionales (CSV entregado por el equipo, 155 frases).
// Se copia a cada equipo la primera vez; luego se administra en Ajustes > Frases.
export type CatalogQuote = { text: string; author: string; category: string };

export const QUOTE_CATEGORIES: Record<string, string> = {
  liderazgo: "Liderazgo",
  miedo: "Miedo",
  excelencia: "Excelencia",
  hoy: "Hoy",
  amabilidad: "Amabilidad",
  inspiracion: "Inspiración",
  confianza: "Confianza",
};

export const QUOTES_CATALOG: CatalogQuote[] = [
  {
    "text": "La confianza es la base del gran liderazgo.",
    "author": "Lolly Daskal",
    "category": "liderazgo"
  },
  {
    "text": "Tu primera y principal tarea como líder es hacerte cargo de tu propia energía y luego ayudar a orquestar la energía de quienes te rodean.",
    "author": "Peter Drucker",
    "category": "liderazgo"
  },
  {
    "text": "Nadie llegará a ser un gran líder si quiere hacerlo todo solo o llevarse todo el crédito por hacerlo.",
    "author": "Andrew Carnegie",
    "category": "liderazgo"
  },
  {
    "text": "Ser un gran líder no significa ser perfecto. Significa vivir con tus imperfecciones.",
    "author": "Lolly Daskal",
    "category": "liderazgo"
  },
  {
    "text": "Un líder es quien conoce el camino, recorre el camino y muestra el camino.",
    "author": "John C. Maxwell",
    "category": "liderazgo"
  },
  {
    "text": "Liderar es resolver problemas.",
    "author": "Colin Powell",
    "category": "liderazgo"
  },
  {
    "text": "No esperes a los líderes; hazlo tú mismo, de persona a persona.",
    "author": "Madre Teresa",
    "category": "liderazgo"
  },
  {
    "text": "Los grandes líderes casi siempre son grandes simplificadores: atraviesan discusiones, debates y dudas para ofrecer una solución que todos puedan entender.",
    "author": "Colin Powell",
    "category": "liderazgo"
  },
  {
    "text": "Gestionar es hacer bien las cosas; liderar es hacer las cosas correctas.",
    "author": "Peter Drucker",
    "category": "liderazgo"
  },
  {
    "text": "Conviértete en el tipo de líder al que la gente seguiría voluntariamente, aunque no tuvieras cargo ni puesto.",
    "author": "Brian Tracy",
    "category": "liderazgo"
  },
  {
    "text": "Los líderes dedican el 5% de su tiempo al problema y el 95% a la solución.",
    "author": "Tony Robbins",
    "category": "liderazgo"
  },
  {
    "text": "No todos los lectores son líderes, pero todos los líderes son lectores.",
    "author": "Harry S. Truman",
    "category": "liderazgo"
  },
  {
    "text": "Quien no sabe ser un buen seguidor no puede ser un buen líder.",
    "author": "Aristóteles",
    "category": "liderazgo"
  },
  {
    "text": "Los líderes piensan y hablan de soluciones. Los seguidores piensan y hablan de problemas.",
    "author": "Brian Tracy",
    "category": "liderazgo"
  },
  {
    "text": "Un líder es mejor cuando la gente apenas sabe que existe. Cuando su obra está hecha y su meta cumplida, dirán: lo hicimos nosotros mismos.",
    "author": "Lao Tse",
    "category": "liderazgo"
  },
  {
    "text": "Las víctimas recitan problemas; los líderes aportan soluciones.",
    "author": "Robin Sharma",
    "category": "liderazgo"
  },
  {
    "text": "El precio del liderazgo es renunciar al interés propio.",
    "author": "Simon Sinek",
    "category": "liderazgo"
  },
  {
    "text": "El liderazgo empieza desde arriba.",
    "author": "Morgan Wootten",
    "category": "liderazgo"
  },
  {
    "text": "Para guiar a la gente, camina detrás de ella.",
    "author": "Lao Tse",
    "category": "liderazgo"
  },
  {
    "text": "No vayas a donde te lleve el camino; ve a donde no hay camino y deja huella.",
    "author": "Muriel Strode",
    "category": "liderazgo"
  },
  {
    "text": "Nuestros mayores miedos residen en la anticipación.",
    "author": "Honoré de Balzac",
    "category": "miedo"
  },
  {
    "text": "Ganas fuerza, valor y confianza con cada experiencia en la que realmente te detienes a mirar al miedo a la cara.",
    "author": "Eleanor Roosevelt",
    "category": "miedo"
  },
  {
    "text": "MIEDO tiene dos significados en inglés: 'Olvídalo todo y huye' o 'Enfréntalo todo y levántate'. Tú eliges.",
    "author": "Zig Ziglar",
    "category": "miedo"
  },
  {
    "text": "El fracaso es una opción; el miedo, no.",
    "author": "James Cameron",
    "category": "miedo"
  },
  {
    "text": "Uno nunca teme a lo desconocido; teme a que lo conocido llegue a su fin.",
    "author": "Jiddu Krishnamurti",
    "category": "miedo"
  },
  {
    "text": "Si intentas deshacerte del miedo y la ira sin entender su significado, se harán más fuertes y regresarán.",
    "author": "Deepak Chopra",
    "category": "miedo"
  },
  {
    "text": "No temas crecer lentamente; teme solo quedarte quieto.",
    "author": "Proverbio chino",
    "category": "miedo"
  },
  {
    "text": "Todo lo que siempre has querido está al otro lado del miedo.",
    "author": "George Addair",
    "category": "miedo"
  },
  {
    "text": "No te dejes empujar por los miedos de tu mente. Déjate guiar por los sueños de tu corazón.",
    "author": "Roy T. Bennett",
    "category": "miedo"
  },
  {
    "text": "Los hombres llegan mucho más lejos para evitar lo que temen que para obtener lo que desean.",
    "author": "Dan Brown",
    "category": "miedo"
  },
  {
    "text": "Un hombre movido por el miedo siempre está calculando, planeando, arreglando, protegiéndose. Así se le va la vida entera.",
    "author": "Osho",
    "category": "miedo"
  },
  {
    "text": "Cuando no tienes miedo, te vuelves más creativo.",
    "author": "Gurbaksh Chahal",
    "category": "miedo"
  },
  {
    "text": "No temas perder oportunidades. Detrás de cada fracaso hay una oportunidad que alguien desearía haber dejado pasar.",
    "author": "Lily Tomlin",
    "category": "miedo"
  },
  {
    "text": "El valor es saber qué no temer.",
    "author": "Platón",
    "category": "miedo"
  },
  {
    "text": "Solo hay una cosa que hace imposible cumplir un sueño: el miedo a fracasar.",
    "author": "Paulo Coelho",
    "category": "miedo"
  },
  {
    "text": "Ten una visión, confía en ti, rompe algunas reglas, ignora a los pesimistas y no tengas miedo de fracasar.",
    "author": "Arnold Schwarzenegger",
    "category": "miedo"
  },
  {
    "text": "Cuando vas más allá de tu miedo, te sientes libre.",
    "author": "Spencer Johnson",
    "category": "miedo"
  },
  {
    "text": "El valor es miedo que ya rezó y decidió seguir adelante de todos modos.",
    "author": "Joyce Meyer",
    "category": "miedo"
  },
  {
    "text": "El miedo no tiene ningún poder especial, a menos que se lo des al someterte a él.",
    "author": "Les Brown",
    "category": "miedo"
  },
  {
    "text": "No tengas miedo de renunciar a lo bueno para ir por lo grandioso.",
    "author": "John D. Rockefeller",
    "category": "miedo"
  },
  {
    "text": "Para que tu vida sea grandiosa, tu fe debe ser más grande que tu miedo.",
    "author": "Robin Sharma",
    "category": "miedo"
  },
  {
    "text": "Nunca temas las disputas; busca las aventuras arriesgadas.",
    "author": "Alexandre Dumas",
    "category": "miedo"
  },
  {
    "text": "El miedo, la incertidumbre y la incomodidad son tus brújulas hacia el crecimiento.",
    "author": "Celestine Chua",
    "category": "miedo"
  },
  {
    "text": "Nunca temas alzar la voz por la honestidad, la verdad y la compasión, contra la injusticia, la mentira y la codicia.",
    "author": "William Faulkner",
    "category": "miedo"
  },
  {
    "text": "Los ganadores no temen perder; los perdedores sí. El fracaso es parte del proceso del éxito. Quien evita el fracaso también evita el éxito.",
    "author": "Robert Kiyosaki",
    "category": "miedo"
  },
  {
    "text": "Lo único a lo que debemos temer es al miedo mismo.",
    "author": "Franklin D. Roosevelt",
    "category": "miedo"
  },
  {
    "text": "Los miedos no son más que un estado mental.",
    "author": "Napoleon Hill",
    "category": "miedo"
  },
  {
    "text": "La clave del éxito es enfocar la mente consciente en lo que deseamos, no en lo que tememos.",
    "author": "Brian Tracy",
    "category": "miedo"
  },
  {
    "text": "El secreto de la salud plena está en mantener la mente siempre alegre: nunca preocupada, nunca apurada, nunca abrumada por el miedo, los pensamientos o la ansiedad.",
    "author": "Sathya Sai Baba",
    "category": "miedo"
  },
  {
    "text": "El miedo es tu peor enemigo. El riesgo, tu mejor amigo.",
    "author": "Gurbaksh Chahal",
    "category": "miedo"
  },
  {
    "text": "El miedo es lo que te detiene. El valor es lo que te mantiene en marcha.",
    "author": "Anónimo",
    "category": "miedo"
  },
  {
    "text": "Una conciencia limpia nunca teme que toquen a la puerta a medianoche.",
    "author": "Proverbio chino",
    "category": "miedo"
  },
  {
    "text": "Las grandes mentes siempre son temidas por las mentes pequeñas.",
    "author": "Dan Brown",
    "category": "miedo"
  },
  {
    "text": "El miedo es estúpido. Y los arrepentimientos también.",
    "author": "Marilyn Monroe",
    "category": "miedo"
  },
  {
    "text": "El miedo es una reacción natural al acercarse a la verdad.",
    "author": "Pema Chödrön",
    "category": "miedo"
  },
  {
    "text": "Si tienes miedo de morir, tienes miedo de vivir. No puedes tener lo uno sin lo otro.",
    "author": "Rita Mae Brown",
    "category": "miedo"
  },
  {
    "text": "Ten la actitud intrépida de un héroe y el corazón amoroso de un niño.",
    "author": "Soyen Shaku",
    "category": "miedo"
  },
  {
    "text": "Lo que tememos al mirar la muerte y la oscuridad es lo desconocido, nada más.",
    "author": "J. K. Rowling (Albus Dumbledore)",
    "category": "miedo"
  },
  {
    "text": "El propósito de la vida es vivirla, saborear la experiencia al máximo y buscar con entusiasmo y sin miedo experiencias nuevas y más ricas.",
    "author": "Eleanor Roosevelt",
    "category": "miedo"
  },
  {
    "text": "La vida puede ser maravillosa si no le tienes miedo.",
    "author": "Charles Chaplin",
    "category": "miedo"
  },
  {
    "text": "No temas al fracaso; teme no intentarlo.",
    "author": "Roy T. Bennett",
    "category": "miedo"
  },
  {
    "text": "El miedo a la muerte es más temible que la muerte misma.",
    "author": "Publilio Siro",
    "category": "miedo"
  },
  {
    "text": "La excelencia no es una habilidad. Es una actitud.",
    "author": "Ralph Marston",
    "category": "excelencia"
  },
  {
    "text": "Si vas a lograr la excelencia en las cosas grandes, desarrolla el hábito en las pequeñas.",
    "author": "Colin Powell",
    "category": "excelencia"
  },
  {
    "text": "La suprema excelencia consiste en quebrar la resistencia del enemigo sin luchar.",
    "author": "Sun Tzu",
    "category": "excelencia"
  },
  {
    "text": "Busca la excelencia, no la perfección, porque no vivimos en un mundo perfecto.",
    "author": "Joyce Meyer",
    "category": "excelencia"
  },
  {
    "text": "La perfección no es alcanzable, pero si la perseguimos podemos alcanzar la excelencia.",
    "author": "Vince Lombardi",
    "category": "excelencia"
  },
  {
    "text": "Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un hábito.",
    "author": "Will Durant",
    "category": "excelencia"
  },
  {
    "text": "Si te enfocas en el éxito, tendrás estrés. Pero si persigues la excelencia, el éxito estará garantizado.",
    "author": "Deepak Chopra",
    "category": "excelencia"
  },
  {
    "text": "Prefiere ser derrotado ante los sabios que sobresalir entre los necios.",
    "author": "Dōgen",
    "category": "excelencia"
  },
  {
    "text": "La excelencia no es una excepción; es una actitud constante.",
    "author": "Colin Powell",
    "category": "excelencia"
  },
  {
    "text": "Nadie debería avergonzarse de admitir que se equivocó; eso solo significa que hoy es más sabio que ayer.",
    "author": "Jonathan Swift",
    "category": "hoy"
  },
  {
    "text": "Toma tu posición hoy. En este lugar. En este día.",
    "author": "Ming-Dao Deng",
    "category": "hoy"
  },
  {
    "text": "Alguien está sentado hoy a la sombra porque alguien plantó un árbol hace mucho tiempo.",
    "author": "Warren Buffett",
    "category": "hoy"
  },
  {
    "text": "A partir de hoy, trata a cada persona que conozcas como si fuera a morir a medianoche. Tu vida nunca volverá a ser la misma.",
    "author": "Og Mandino",
    "category": "hoy"
  },
  {
    "text": "Olvida el ayer: ya te olvidó. No te angusties por el mañana: ni siquiera se conocen. Abre tus ojos y tu corazón a un regalo valioso: el hoy.",
    "author": "Steve Maraboli",
    "category": "hoy"
  },
  {
    "text": "Lo que haces hoy puede mejorar todos tus mañanas.",
    "author": "Ralph Marston",
    "category": "hoy"
  },
  {
    "text": "No sabemos nada del mañana; nuestra tarea es ser buenos y felices hoy.",
    "author": "Sydney Smith",
    "category": "hoy"
  },
  {
    "text": "Un pequeño cambio hoy trae un mañana radicalmente distinto.",
    "author": "Richard Bach",
    "category": "hoy"
  },
  {
    "text": "Hoy tú eres tú, y eso es más cierto que lo cierto. No hay nadie vivo que sea más tú que tú.",
    "author": "Dr. Seuss",
    "category": "hoy"
  },
  {
    "text": "La ansiedad no le quita al mañana sus penas; solo le quita al hoy sus fuerzas.",
    "author": "Charles Spurgeon",
    "category": "hoy"
  },
  {
    "text": "Las consecuencias de hoy las determinan las acciones del pasado. Para cambiar tu futuro, cambia tus decisiones hoy.",
    "author": "Anónimo",
    "category": "hoy"
  },
  {
    "text": "Trabaja como si fueras a vivir para siempre y vive como si fueras a morir hoy. Recorre una milla más.",
    "author": "Og Mandino",
    "category": "hoy"
  },
  {
    "text": "Recuerda: hoy es el mañana que te preocupaba ayer.",
    "author": "Dale Carnegie",
    "category": "hoy"
  },
  {
    "text": "Hoy es suficiente; este momento basta. El mañana llegará a su tiempo. Mientras tanto, vive la profundidad del ahora.",
    "author": "Ralph Marston",
    "category": "hoy"
  },
  {
    "text": "La meta no es ser perfecto al final; la meta es ser mejor hoy.",
    "author": "Simon Sinek",
    "category": "hoy"
  },
  {
    "text": "El ayer no es más que el recuerdo de hoy, y el mañana es el sueño de hoy.",
    "author": "Khalil Gibran",
    "category": "hoy"
  },
  {
    "text": "Cuidar mi salud hoy me da una mejor esperanza para mañana.",
    "author": "Anne Wilson Schaef",
    "category": "hoy"
  },
  {
    "text": "¿Qué has hecho hoy para hacer feliz a alguien más?",
    "author": "Deepam Chatterjee",
    "category": "hoy"
  },
  {
    "text": "Ansiamos nuevas sensaciones, pero pronto nos volvemos indiferentes a ellas. Las maravillas de ayer son hoy cosa común.",
    "author": "Nikola Tesla",
    "category": "hoy"
  },
  {
    "text": "El ayer es historia, el mañana es un misterio y el hoy es un regalo; por eso se llama presente.",
    "author": "Bil Keane",
    "category": "hoy"
  },
  {
    "text": "Cada noche, antes de dormir, debemos preguntarnos: ¿qué debilidad superé hoy? ¿Qué virtud adquirí?",
    "author": "Séneca",
    "category": "hoy"
  },
  {
    "text": "Si creemos que el mañana será mejor, podemos soportar una dificultad hoy.",
    "author": "Thich Nhat Hanh",
    "category": "hoy"
  },
  {
    "text": "Quizá lo más trágico de la humanidad es que todos soñamos con un jardín mágico en el horizonte, en lugar de disfrutar las rosas que florecen hoy junto a nuestra ventana.",
    "author": "Dale Carnegie",
    "category": "hoy"
  },
  {
    "text": "Creas tu propio presente según aquello a lo que le prestas atención hoy.",
    "author": "Spencer Johnson",
    "category": "hoy"
  },
  {
    "text": "El hermoso viaje de hoy solo puede comenzar cuando aprendemos a soltar el ayer.",
    "author": "Steve Maraboli",
    "category": "hoy"
  },
  {
    "text": "El único límite para lograr nuestro mañana serán nuestras dudas de hoy.",
    "author": "Franklin D. Roosevelt",
    "category": "hoy"
  },
  {
    "text": "Hoy comienzo una nueva vida. Recibiré este día con amor en mi corazón.",
    "author": "Og Mandino",
    "category": "hoy"
  },
  {
    "text": "Hoy estás donde tus pensamientos te han traído.",
    "author": "James Allen",
    "category": "hoy"
  },
  {
    "text": "El futuro depende de lo que hagas hoy.",
    "author": "Mahatma Gandhi",
    "category": "hoy"
  },
  {
    "text": "No dejes que el ayer ocupe demasiado del hoy.",
    "author": "Will Rogers",
    "category": "hoy"
  },
  {
    "text": "El ayer se fue. El mañana aún no llega. Solo tenemos el hoy.",
    "author": "Madre Teresa",
    "category": "hoy"
  },
  {
    "text": "El día de hoy no volverá a repetirse. No lo desperdicies con un mal comienzo o sin comenzar.",
    "author": "Og Mandino",
    "category": "hoy"
  },
  {
    "text": "Olvida los errores. Olvida el fracaso. Olvídalo todo excepto lo que vas a hacer ahora, y hazlo. ¡Hoy es tu día de suerte!",
    "author": "Og Mandino",
    "category": "hoy"
  },
  {
    "text": "La amabilidad es un lenguaje que los sordos pueden oír y los ciegos pueden ver.",
    "author": "Christian Nestell Bovee",
    "category": "amabilidad"
  },
  {
    "text": "La ternura y la amabilidad no son señales de debilidad ni de desesperación, sino manifestaciones de fuerza y determinación.",
    "author": "Khalil Gibran",
    "category": "amabilidad"
  },
  {
    "text": "Muestra amabilidad, pero nunca la esperes. Muestra autenticidad, pero nunca la esperes. Solo los sabios son indiferentes a lo que no pueden controlar.",
    "author": "Maxime Lagacé",
    "category": "amabilidad"
  },
  {
    "text": "Un solo acto de bondad echa raíces en todas direcciones, y esas raíces brotan y forman nuevos árboles.",
    "author": "Amelia Earhart",
    "category": "amabilidad"
  },
  {
    "text": "Es sabio decir la verdad. Es aún más sabio decirla con amabilidad.",
    "author": "Maxime Lagacé",
    "category": "amabilidad"
  },
  {
    "text": "Ser amable es más importante que tener la razón.",
    "author": "David Brinkley",
    "category": "amabilidad"
  },
  {
    "text": "Las palabras amables pueden ser breves y fáciles de decir, pero su eco es verdaderamente infinito.",
    "author": "Madre Teresa",
    "category": "amabilidad"
  },
  {
    "text": "Muestra siempre más amabilidad de la que parece necesaria, porque quien la recibe la necesita más de lo que jamás sabrás.",
    "author": "Colin Powell",
    "category": "amabilidad"
  },
  {
    "text": "Un acto de amabilidad espontáneo, por pequeño que sea, puede tener un impacto enorme en la vida de otra persona.",
    "author": "Roy T. Bennett",
    "category": "amabilidad"
  },
  {
    "text": "Procura siempre ser un poco más amable de lo necesario.",
    "author": "J. M. Barrie",
    "category": "amabilidad"
  },
  {
    "text": "Ninguna acción amable termina en sí misma. Una lleva a otra. El buen ejemplo se sigue.",
    "author": "Amelia Earhart",
    "category": "amabilidad"
  },
  {
    "text": "Sé amable, porque cada persona que conoces está librando una batalla difícil.",
    "author": "Ian Maclaren",
    "category": "amabilidad"
  },
  {
    "text": "Sé consciente. Sé agradecido. Sé positivo. Sé auténtico. Sé amable.",
    "author": "Roy T. Bennett",
    "category": "amabilidad"
  },
  {
    "text": "Trata a todos con cortesía y amabilidad, no porque ellos lo sean, sino porque tú lo eres.",
    "author": "Roy T. Bennett",
    "category": "amabilidad"
  },
  {
    "text": "Mantén la calma. Sé amable.",
    "author": "Colin Powell",
    "category": "amabilidad"
  },
  {
    "text": "Sé amable siempre que sea posible. Siempre es posible.",
    "author": "Dalái Lama",
    "category": "amabilidad"
  },
  {
    "text": "A la larga, la más afilada de todas las armas es un espíritu amable y gentil.",
    "author": "Ana Frank",
    "category": "amabilidad"
  },
  {
    "text": "No necesitas mover montañas. Cambiarás el mundo simplemente siendo un ser humano cálido y de buen corazón.",
    "author": "Anita Krizzan",
    "category": "amabilidad"
  },
  {
    "text": "El más pequeño acto de bondad vale más que la mayor de las intenciones.",
    "author": "Khalil Gibran",
    "category": "amabilidad"
  },
  {
    "text": "Cuanto más amable seas contigo mismo, más se volverá esa tu respuesta automática hacia los demás.",
    "author": "Wayne Dyer",
    "category": "amabilidad"
  },
  {
    "text": "Antes de hablar, pregúntate: ¿es amable?, ¿es necesario?, ¿es verdad?, ¿mejora el silencio?",
    "author": "Sathya Sai Baba",
    "category": "amabilidad"
  },
  {
    "text": "La amabilidad en las palabras crea confianza. La amabilidad en el pensamiento crea profundidad. La amabilidad al dar crea amor.",
    "author": "Lao Tse",
    "category": "amabilidad"
  },
  {
    "text": "La mayor obra de la amabilidad es que vuelve amables a los demás.",
    "author": "Amelia Earhart",
    "category": "amabilidad"
  },
  {
    "text": "Ayuda a los demás por todas las veces que te ignoraron. Sé amable con los demás por todas las veces que te despreciaron.",
    "author": "Ming-Dao Deng",
    "category": "amabilidad"
  },
  {
    "text": "Descansa y sé amable; no tienes que demostrar nada.",
    "author": "Jack Kerouac",
    "category": "amabilidad"
  },
  {
    "text": "Si quieres ser feliz, fíjate una meta que guíe tus pensamientos, libere tu energía e inspire tus esperanzas.",
    "author": "Andrew Carnegie",
    "category": "inspiracion"
  },
  {
    "text": "Inspírate para ser grandioso. Ser bueno no es suficiente.",
    "author": "Gurbaksh Chahal",
    "category": "inspiracion"
  },
  {
    "text": "Mantén siempre los ojos abiertos. Sigue observando. Porque cualquier cosa que veas puede inspirarte.",
    "author": "Grace Coddington",
    "category": "inspiracion"
  },
  {
    "text": "No puedes esperar a la inspiración. Tienes que salir a buscarla con un garrote.",
    "author": "Jack London",
    "category": "inspiracion"
  },
  {
    "text": "El genio es un uno por ciento de inspiración y un noventa y nueve por ciento de transpiración.",
    "author": "Thomas Edison",
    "category": "inspiracion"
  },
  {
    "text": "La gente te inspira o te agota. Elígela con sabiduría.",
    "author": "Les Brown",
    "category": "inspiracion"
  },
  {
    "text": "En lugar de dejarte intimidar por las limitaciones, inspírate para encontrar nuevas formas de superarlas.",
    "author": "Ralph Marston",
    "category": "inspiracion"
  },
  {
    "text": "Si necesitas inspiración para hacerlo, no lo hagas.",
    "author": "Elon Musk",
    "category": "inspiracion"
  },
  {
    "text": "Los aficionados se sientan a esperar la inspiración; los demás simplemente nos levantamos y nos ponemos a trabajar.",
    "author": "Stephen King",
    "category": "inspiracion"
  },
  {
    "text": "Ser heroico es tener el valor de morir por algo; ser inspirador es estar lo bastante loco como para vivir un poco.",
    "author": "Criss Jami",
    "category": "inspiracion"
  },
  {
    "text": "En la vida necesitas inspiración o desesperación.",
    "author": "Tony Robbins",
    "category": "inspiracion"
  },
  {
    "text": "La inspiración existe, pero tiene que encontrarte trabajando.",
    "author": "Pablo Picasso",
    "category": "inspiracion"
  },
  {
    "text": "La confianza es como un dragón: por cada cabeza que le cortan, le crecen dos más.",
    "author": "Criss Jami",
    "category": "confianza"
  },
  {
    "text": "La confianza nace de cruzar umbrales.",
    "author": "Kamal Ravikant",
    "category": "confianza"
  },
  {
    "text": "La confianza es pensar de forma constante en lo que es posible y en cómo hacerlo posible.",
    "author": "John Eliot",
    "category": "confianza"
  },
  {
    "text": "La confianza es el mejor amigo.",
    "author": "Lao Tse",
    "category": "confianza"
  },
  {
    "text": "El optimismo es la fe que conduce al logro. Nada puede hacerse sin esperanza y confianza.",
    "author": "Helen Keller",
    "category": "confianza"
  },
  {
    "text": "La confianza engendra belleza.",
    "author": "Estée Lauder",
    "category": "confianza"
  },
  {
    "text": "La confianza es contagiosa. La falta de confianza también.",
    "author": "Vince Lombardi",
    "category": "confianza"
  },
  {
    "text": "La confianza es lo que tienes antes de entender el problema.",
    "author": "Woody Allen",
    "category": "confianza"
  },
  {
    "text": "Sé cortés con todos, pero íntimo con pocos, y que esos pocos sean bien probados antes de darles tu confianza.",
    "author": "George Washington",
    "category": "confianza"
  },
  {
    "text": "¡Cree en ti! ¡Ten fe en tus capacidades! Sin una confianza humilde pero razonable en tus propias fuerzas no puedes tener éxito ni ser feliz.",
    "author": "Norman Vincent Peale",
    "category": "confianza"
  },
  {
    "text": "La confianza no garantiza el éxito, pero es una forma de pensar que aumenta tus probabilidades de lograrlo.",
    "author": "John Eliot",
    "category": "confianza"
  },
  {
    "text": "Sin confianza no se puede lograr nada.",
    "author": "Sathya Sai Baba",
    "category": "confianza"
  },
  {
    "text": "Nada es demasiado alto para que alguien lo alcance, pero debe escalar con cuidado y confianza.",
    "author": "Hans Christian Andersen",
    "category": "confianza"
  },
  {
    "text": "La confianza no viene de tener siempre la razón, sino de no temer equivocarse.",
    "author": "Peter T. McIntyre",
    "category": "confianza"
  }
];
