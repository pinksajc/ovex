# Diagnóstico Gmail Sync — ORVEX
**Fecha:** 2026-06-16  
**Estado general:** ⚠️ Sistema parcialmente construido — funciona en código pero desconectado de la UI + faltan variables de entorno

---

## 1. Cron Job (`/api/cron/gmail-sync`)

### Estado: ✅ Código correcto — ⚠️ Variables de entorno no configuradas localmente

**`vercel.json`** — correcto:
```json
{ "crons": [{ "path": "/api/cron/gmail-sync", "schedule": "*/15 * * * *" }] }
```

**Handler** — `src/app/api/cron/gmail-sync/route.ts`:
- Exporta `GET` correctamente ✅
- Verifica `Authorization: Bearer ${CRON_SECRET}` ✅
- Itera deals con `contact_email NOT NULL AND owner_id NOT NULL` ✅
- Lee `contact_overrides.emails[]` (fallback a `contact_email`) ✅
- Construye query Gmail multi-email: `(from:e1 OR to:e1 OR from:e2 OR to:e2) after:unix` ✅
- Deduplica por `gmail_message_id` con índice UNIQUE ✅

**Problema:** `CRON_SECRET` **no está en `.env.local`** (solo están `SUPABASE_*`).  
Sin esta variable, el cron devuelve 401 a cualquier llamada — incluyendo las de Vercel.

**Variables ausentes en `.env.local`:**
```
CRON_SECRET=<no configurado>
GOOGLE_CLIENT_ID=<no configurado>
GOOGLE_CLIENT_SECRET=<no configurado>
```

---

## 2. Tokens de Gmail (`gmail_tokens`)

### Estado: ⚠️ No verificable sin acceso directo a Supabase — flujo de guardado es correcto

**Migración `20260615000002_gmail_tokens.sql`** — tabla definida correctamente:
```sql
CREATE TABLE gmail_tokens (
  id           UUID PRIMARY KEY,
  user_id      UUID UNIQUE REFERENCES auth.users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  ...
);
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON gmail_tokens FOR ALL TO service_role ...
```

**`upsertGmailToken`** — guarda correctamente con `onConflict: 'user_id'` ✅  
**`getValidAccessToken`** — auto-refresca si expira, borra token si refresh_token revocado ✅

**Riesgo conocido en callback:** si el usuario ya había concedido acceso previamente y no revoca primero, Google **no devuelve `refresh_token`** en el segundo OAuth. El callback detecta esto y redirige a `?gmail=no_refresh`, pero el token anterior (posiblemente expirado) permanece en DB sin actualizarse.

**Para verificar tokens activos:** ejecutar en Supabase SQL Editor:
```sql
SELECT user_id, expires_at, updated_at,
       CASE WHEN expires_at < NOW() THEN 'EXPIRED' ELSE 'valid' END as status
FROM gmail_tokens;
```

---

## 3. Flujo de conexión Gmail

### Estado: ✅ Flujo completo implementado — ⚠️ Hardcoded callback URL

**Endpoints:**
- `GET /api/auth/gmail/connect` — genera OAuth URL con `prompt: consent` ✅
- `GET /api/auth/gmail/callback` — intercambia code → tokens → `upsertGmailToken` ✅
- UI en `/usuarios` — `GmailConnectButton` con estados connected/disconnected ✅

**Bug:** El `redirect_uri` está **hardcodeado** en ambos archivos:
```typescript
// connect/route.ts y callback/route.ts
const callbackUrl = 'https://orvex.platomico.com/api/auth/gmail/callback'
```
En local (`localhost:3000`) el OAuth falla porque Google valida que el `redirect_uri` coincida exactamente con los URIs registrados en Google Cloud Console. Solo funciona en producción Vercel.

**Requiere en Google Cloud Console:**
- OAuth 2.0 Client ID creado con scope `gmail.readonly`
- Redirect URI autorizado: `https://orvex.platomico.com/api/auth/gmail/callback`
- Variables `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Vercel Dashboard

---

## 4. Importación manual (deal detail)

### Estado: ❌ DESCONECTADO — `GmailSearchPanel` existe pero no está montado en ninguna página

**Componente `src/components/deals/gmail-search-panel.tsx`** — completamente implementado:
- `handleSearch` → `GET /api/deals/[id]/gmail-search` ✅
- `handleImport` → `POST /api/deals/[id]/gmail-import` ✅
- UI con checkboxes, panel de resultados, botón "Importar seleccionados" ✅

**Endpoints:**
- `GET /api/deals/[id]/gmail-search` — busca emails del contacto en Gmail del usuario ✅
- `POST /api/deals/[id]/gmail-import` — inserta emails seleccionados como `deal_comments` ✅

**Problema crítico:** `GmailSearchPanel` **no está importado ni usado en ningún sitio**:
```bash
$ grep -rn "GmailSearchPanel" src/
# Solo aparece en su propio archivo de definición
```

El componente fue removido de `src/app/deals/[id]/page.tsx` y de `DealCommentsPanel` en una sesión anterior al migrar al cron automático, pero el cron automático requiere tokens de Gmail ya configurados y variables de entorno que no están activas.

**Resultado:** el usuario no tiene ninguna forma de importar emails manualmente ni automáticamente en el estado actual.

---

## 5. Tabla `deal_comments`

### Estado: ✅ Esquema correcto — ⚠️ Migración FK puede no estar aplicada

**Columnas relevantes:**
```sql
deal_comments (
  id                UUID PK,
  deal_id           UUID REFERENCES deals(id),
  user_id           UUID,          -- FK re-apuntada a profiles(id) en migración 000005
  type              TEXT CHECK IN ('call','email','meeting','whatsapp','other'),
  content           TEXT,
  gmail_message_id  TEXT,          -- añadido en migración 000006
  created_at        TIMESTAMPTZ
)
```

**RLS:** `ENABLE ROW LEVEL SECURITY` + policy `service_role FULL ACCESS`.  
El cliente Supabase usa `SUPABASE_SERVICE_ROLE_KEY` → bypasa RLS correctamente ✅

**Deduplicación:**
```sql
CREATE UNIQUE INDEX deal_comments_gmail_message_id_idx
  ON deal_comments(gmail_message_id) WHERE gmail_message_id IS NOT NULL;
```
✅ (migración 000006)

**Migraciones que deben estar aplicadas en Supabase:**

| Migración | Descripción | Estado |
|---|---|---|
| `000001_deal_comments.sql` | Tabla base + RLS | Verificar |
| `000005_deal_comments_fk_profiles.sql` | FK user_id → profiles(id) | **Crítico** |
| `000006_deal_comments_gmail_id.sql` | Columna + índice gmail_message_id | Verificar |
| `000007_contact_email_array.sql` | emails TEXT[] en contact_overrides | **Pendiente** |

---

## Causa raíz del problema

El sistema no importa emails de Gmail por **tres causas simultáneas**:

### Causa 1 — Más crítica: `GmailSearchPanel` fue removido de la UI sin reemplazo funcional

En una sesión anterior se eliminó el botón "Buscar emails en Gmail" del panel de seguimiento del deal (para migrar al cron automático). El cron automático existe en código pero no funciona en producción por las causas 2 y 3. El usuario quedó **sin ningún mecanismo activo** para importar emails.

### Causa 2: Variables de entorno no configuradas en Vercel

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `CRON_SECRET` no están en `.env.local` ni (presumiblemente) en Vercel Dashboard. Sin ellas:
- La conexión OAuth de Gmail falla con error 500
- El cron devuelve 401 Unauthorized a cada invocación de Vercel
- `getValidAccessToken` no puede refrescar tokens expirados

### Causa 3: Callback URL hardcodeada + `gmail_tokens` potencialmente vacía

Si nunca se completó exitosamente el flujo OAuth (por Causa 2), la tabla `gmail_tokens` está vacía → el cron no encuentra tokens para ningún usuario → no importa nada.

---

## Plan de acción (por orden de prioridad)

### Paso 1 — Inmediato: Reactivar importación manual
Volver a añadir `GmailSearchPanel` al deal detail view. Es el único flujo que funciona sin depender del cron o del OAuth completado. Actualmente el componente existe en `src/components/deals/gmail-search-panel.tsx` y solo falta montarlo.

### Paso 2 — Configurar variables de entorno en Vercel Dashboard
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CRON_SECRET=<string aleatorio seguro>
```

### Paso 3 — Conectar Gmail desde `/usuarios`
Cada usuario que quiera sync automático debe ir a `/usuarios` y hacer clic en "Conectar Gmail". Esto ejecuta el flujo OAuth y guarda el `refresh_token` en `gmail_tokens`.

### Paso 4 — Verificar migraciones en Supabase SQL Editor
Ejecutar en orden si no están aplicadas:
1. `supabase/migrations/20260615000005_deal_comments_fk_profiles.sql`
2. `supabase/migrations/20260615000006_deal_comments_gmail_id.sql`
3. `supabase/migrations/20260615000007_contact_email_array.sql`

### Paso 5 — Verificar cron en Vercel
Vercel → Project → Settings → **Cron Jobs** (requiere plan Pro).  
Confirmar que el cron aparece y ejecutar manualmente para verificar logs.
