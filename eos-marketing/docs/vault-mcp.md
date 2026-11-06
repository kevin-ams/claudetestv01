# Conectar Claude con EOS (servidor MCP)

EOS Nivel 10 expone un servidor **MCP** (Model Context Protocol) para que Claude —en claude.ai, Claude Desktop o
Claude Code— consulte el vault (Conocimiento) y, si se elige, todo el EOS de la organización. La IA la pone Claude:
en EOS no hay costo extra.

## 1. Generar un token

En **Conocimiento › Conectar con Claude** (requiere el rol *Administrador Premium* o que el dueño de la plataforma
haya abierto el módulo Conocimiento a tu rol):

| Opción | Qué permite |
|---|---|
| **Solo el vault** | `search_notes`, `read_note`, `list_notes`, `get_backlinks`, `list_tags` |
| **Vault + EOS completo** | lo anterior + `eos_overview`, `list_rocks`, `get_scorecard`, `get_career_indicators` (semanal o mensual), `list_issues`, `list_todos`, `get_vto`, `get_org_chart`, `list_meetings`, `get_team_agenda` |
| **Permitir crear y editar** | vault: `create_note`, `append_to_note`, `update_note`; con EOS: `create_issue`, `create_todo`, `complete_todo`, `update_rock_status`, `set_scorecard_value` |

- El token actúa **como la persona que lo creó**, en su equipo y con los permisos de su rol (se revisan en cada
  petición: si el rol cambia o pierde el módulo Conocimiento, el token deja de servir).
- Se muestra **una sola vez**; en la base de datos solo queda su hash (SHA-256).
- Se puede **revocar** desde la misma pantalla (quien lo creó o un administrador). Deja de funcionar al instante.
- Límite: 120 peticiones por minuto por token. Cada uso actualiza "último uso".
- Lo que Claude cambia queda en la bitácora de actividad con "(vía Claude)".

## 2. Agregarlo en Claude

**claude.ai / Claude Desktop:** Ajustes → Conectores → *Agregar conector personalizado* → pega la URL
`https://<tu-dominio>/api/mcp/<token>` → Agregar. En el chat, actívalo desde el menú de herramientas.

**Claude Code:**

```bash
claude mcp add --transport http eos https://<tu-dominio>/api/mcp/<token>
# o con el token en la cabecera:
claude mcp add --transport http eos https://<tu-dominio>/api/mcp --header "Authorization: Bearer <token>"
```

## 3. Consultor IA (opcional)

Si se crea en Claude un consultor (un artefacto que usa este conector y responde citando las notas), su enlace se
guarda en *Conectar con Claude › Consultor IA* y aparece el botón **Preguntar a la IA (Claude)** en el vault.

## Detalles técnicos

- Rutas: `POST /api/mcp/[token]` y `POST /api/mcp` (con `Authorization: Bearer`). `GET`/`DELETE` responden 405.
- Transporte **Streamable HTTP sin estado** (`@modelcontextprotocol/sdk`, `WebStandardStreamableHTTPServerTransport`
  con respuestas JSON): cada petición crea su propio servidor, apto para funciones serverless de Netlify.
- CORS abierto para los conectores remotos de Claude.
- `search_notes` usa la búsqueda de texto de Postgres (sin acentos); el servidor no calcula embeddings (no carga el
  modelo ni paga una API). Claude puede reformular y repetir búsquedas.
- Las descripciones de las herramientas aclaran que el contenido es información y no instrucciones.
- Código: `src/lib/mcp/eos-mcp.ts` (herramientas), `src/lib/mcp/handler.ts` (token, permisos y transporte),
  `src/lib/domain/api-tokens.ts` (tokens; tabla `api_tokens`, migración 039).
