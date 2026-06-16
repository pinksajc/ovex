# Estado del Proyecto — ORVEX
**Última actualización:** 2026-06-16  
**Rama:** `main` — up to date con `origin/main`  
**Último commit:** `22f8e51` — fix: sidebar logo — use icon mark at 28px + Orvex text

---

## ✅ Completado hoy

### 1. Multi-email en contacto de deal
- `contact_overrides.emails TEXT[]` — migración `20260615000007_contact_email_array.sql` (pendiente aplicar en Supabase dashboard)
- `src/types/index.ts` — `Deal.contact.emails: string[]` añadido junto a `email: string`
- `src/lib/supabase/deals.ts` — `rowToDeal` popula `emails: [contact_email]`
- `src/lib/supabase/contact-overrides.ts` — `upsertContactOverride(attioDealId, firstName, lastName, emails[])`, `getContactOverridesForDeals` devuelve `emails[]`
- `src/lib/deals.ts` — override aplica `emails[]` en `enrichWithCommercialStatus`
- `src/app/actions/update-contact.ts` — firma cambiada a `emails: string[]`
- `src/components/contact-editor.tsx` — UI con lista dinámica: primer email no eliminable, botón `+ Añadir email`, ✕ en extras
- `src/app/deals/[id]/page.tsx` — pasa `emails={deal.contact.emails}` a `ContactEditor`
- `src/lib/mock-data.ts` — añadido `emails[]` a todos los deals mock

### 2. Leads — paginación completa sin límite artificial
- `src/app/api/leads/attio/route.ts` — loop paginado con `limit: 200, offset: N`; acepta `?offset=` query param; devuelve `{ deals, hasMore, nextOffset }`
- `src/app/leads/leads-client.tsx` — página 0 se muestra inmediatamente, resto se carga en background; subtítulo actualiza en vivo ("X deals (cargando más…)" → total final)

### 3. Gmail cron sync (completado en sesión anterior, confirmado hoy)
- `vercel.json` en raíz con `"schedule": "*/15 * * * *"` ✅
- `/api/cron/gmail-sync/route.ts` exporta `GET` con `Authorization: Bearer CRON_SECRET` ✅
- Cron itera todos los emails de `contact_overrides.emails` (fallback a `deals.contact_email`)

### 4. Sidebar logo
- `public/orvex-wordmark.png` — copiado desde `~/Downloads/orvex-wordmark-black.png`
- `src/components/layout/sidebar.tsx` — icono 28×28px + texto "Orvex"; filter `brightness(0) invert(1)`
- Eliminado texto "by Platomico" del sidebar

---

## ⚠️ Pendiente / No completado

### Migración `20260615000007_contact_email_array.sql` — **APLICAR EN SUPABASE**
```sql
ALTER TABLE contact_overrides ADD COLUMN IF NOT EXISTS emails TEXT[];
```
El código ya está desplegado pero la columna no existe en producción hasta que se ejecute en el dashboard de Supabase → SQL Editor.

### Cron job Gmail no aparece en Vercel Observability
- El `vercel.json` y el handler son correctos
- Requiere plan **Pro** de Vercel para ver la pestaña "Cron Jobs"
- Verificar en: Vercel → Project → Settings → Cron Jobs (no Observability)
- Verificar que el "Root Directory" del proyecto en Vercel está vacío (no `src/`)
- Añadir variable de entorno `CRON_SECRET` en Vercel Dashboard si no está

### Logo sidebar — pendiente versión horizontal
- El archivo disponible (`orvex-wordmark-black.png`) es un **icono cuadrado 1024×1024**, no un wordmark horizontal
- Solución actual: icono 28×28 + texto "Orvex" (funciona visualmente)
- Para mejorarlo: proporcionar un PNG horizontal del wordmark (ancho × corto, ej. 800×120)

---

## 🐛 Errores conocidos

| Error | Estado | Notas |
|---|---|---|
| `emails` column missing en prod | Bloqueante para multi-email | Aplicar migración `000007` en Supabase |
| Gmail cron no verificable | Informativo | Plan Vercel o pestaña incorrecta |
| `deal_comments.gmail_message_id` | Requiere migración `000006` aplicada | Verificar en prod |

---

## 🏗️ Arquitectura relevante para continuar

### Stack
- **Next.js 16.2.1** con Turbopack — middleware ES `src/proxy.ts` (NUNCA crear `src/middleware.ts`)
- **Supabase** service_role bypasa RLS; cliente via `getSupabaseClient()`
- **Vercel** deployment desde `main`; cron requiere plan Pro

### Roles y permisos (`src/lib/permissions.ts`)
| Rol | Módulos |
|---|---|
| `owner` | Todo |
| `admin` | Todo excepto `usuarios` (tiene acceso también) |
| `growth_manager` | dashboard, deals, leads, pipeline, ofertas, facturas, gestiones, usuarios |
| `sales` | dashboard, deals, pipeline, ofertas, facturas |
| `finance` | dashboard, deals, pipeline, ofertas, facturas, cashflow |

### Migraciones aplicadas en Supabase (confirmar)
- `000001` deal_comments ✅
- `000002` gmail_tokens ✅
- `000003` growth_manager_role ✅
- `000004` must_change_password ✅
- `000005` deal_comments_fk_profiles ✅
- `000006` deal_comments_gmail_id — **verificar**
- `000007` contact_email_array — **PENDIENTE**

### Archivos clave modificados hoy
```
src/components/contact-editor.tsx       ← UI multi-email
src/components/layout/sidebar.tsx       ← logo icono
src/app/deals/[id]/page.tsx             ← emails[] prop
src/app/actions/update-contact.ts       ← emails[] firma
src/lib/supabase/contact-overrides.ts   ← emails[] CRUD
src/lib/supabase/deals.ts               ← emails[] en rowToDeal
src/lib/deals.ts                        ← override con emails[]
src/types/index.ts                      ← Deal.contact.emails[]
src/app/api/leads/attio/route.ts        ← paginación ?offset=
src/app/leads/leads-client.tsx          ← carga progresiva
src/app/api/cron/gmail-sync/route.ts    ← itera emails[]
public/orvex-wordmark.png               ← nuevo asset
supabase/migrations/000007_*.sql        ← pendiente aplicar
```

### Patrón multi-email (resumen para continuar)
```typescript
// Deal.contact siempre tiene:
email: string      // primer email (backwards compat)
emails: string[]   // lista completa (≥1 elemento)

// ContactEditor recibe emails[] y llama:
updateContactAction('', firstName, lastName, emails, dealId)

// upsertContactOverride sincroniza:
// → email = emails[0]   (backwards compat)
// → emails = full array
```

---

## 🔧 Próximos pasos sugeridos

1. **Aplicar migración 000007** en Supabase SQL Editor (crítico para multi-email en prod)
2. Verificar que migración 000006 (`gmail_message_id`) también está aplicada
3. Añadir `CRON_SECRET` en Vercel Dashboard → Environment Variables
4. Proporcionar wordmark horizontal PNG si se quiere mejorar el logo del sidebar
5. Testear end-to-end el flujo de múltiples emails: añadir, guardar, verificar que cron los usa
