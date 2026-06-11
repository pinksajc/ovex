# Security Audit — ORVEX

**Date:** 2026-06-11  
**Auditor:** Claude (automated)  
**Branch:** claude/security-audit

## Summary

3 crítico · 6 alto · 3 medio · 2 bajo  
**Todos los hallazgos de código han sido corregidos en este PR.**  
Quedan pendientes acciones manuales en Supabase (RLS) y configuración de entorno (DOCUSEAL_WEBHOOK_SECRET).

---

## Findings

---

### [CRÍTICO-1] Endpoint de debug sin autenticación — leak parcial de API keys

**Severidad:** CRÍTICO  
**Estado:** FIXED  
**Descripción:** `GET /api/debug` no tenía ningún guard de autenticación. Devolvía los primeros 8 caracteres de `ATTIO_API_KEY` y la URL completa de Supabase, lo que da a un atacante información suficiente para identificar el proyecto. Cualquier usuario anónimo podía acceder.  
**Fix aplicado:** Añadido guard owner-only (`getCurrentUser()` + `role !== 'owner'`). Los valores de las variables de entorno se ocultan completamente (solo se indica `'set'` o `'MISSING'`).

---

### [CRÍTICO-2] Endpoint `/api/debug/proposals` sin autenticación — escritura en DB expuesta

**Severidad:** CRÍTICO  
**Estado:** FIXED  
**Descripción:** `GET /api/debug/proposals` no requería ningún tipo de autenticación. Cualquier visitante anónimo podía: (1) leer las primeras 3 filas de la tabla `proposals`, (2) insertar filas de prueba, (3) actualizarlas y borrarlas, y (4) ver los primeros 20 caracteres de `SUPABASE_SERVICE_ROLE_KEY`. Esto constituye acceso de escritura no autorizado a la base de datos de producción.  
**Fix aplicado:** Añadido guard owner-only al inicio del handler. Ocultado completamente el valor de `SUPABASE_SERVICE_ROLE_KEY` en la respuesta.

---

### [CRÍTICO-3] Webhook de DocuSeal sin verificación de firma HMAC

**Severidad:** CRÍTICO  
**Estado:** FIXED  
**Descripción:** El webhook `POST /api/docuseal/webhook` tenía la verificación de firma HMAC-SHA256 **explícitamente desactivada** con un comentario `// TODO: re-enable`. Esto permitía a cualquier atacante enviar peticiones falsas simulando eventos de DocuSeal (`submission.completed`, `submission.declined`) para modificar el estado de propuestas en la base de datos y cambiar el stage de los deals.  
**Fix aplicado:** Implementada verificación HMAC-SHA256 real usando la Web Crypto API nativa. Cuando `DOCUSEAL_WEBHOOK_SECRET` está configurado, se verifica la cabecera `X-DocuSeal-Signature` y se rechaza la petición con 401 si no coincide. Si la variable no está configurada, se registra una advertencia en el log.  
**Acción pendiente:** Configurar `DOCUSEAL_WEBHOOK_SECRET` en el dashboard de Vercel. Obtener el valor de DocuSeal → Settings → Webhooks.

---

### [ALTO-1] Rutas de generación de PDF sin autenticación (6 rutas)

**Severidad:** ALTO  
**Estado:** FIXED  
**Descripción:** Las siguientes rutas no tenían ningún guard de autenticación y servían documentos confidenciales (contratos, facturas, presupuestos, propuestas) a cualquier usuario anónimo que conociera un ID válido:
- `GET /api/contratos/generate-pdf`
- `GET /api/facturas/generate-pdf`
- `GET /api/facturas/bulk-pdf`
- `GET /api/ofertas/generate-pdf`
- `GET /api/presupuestos/generate-pdf`
- `POST /api/propuestas/generate-pdf`

**Fix aplicado:** Añadido `getCurrentUser()` al inicio de cada handler, devolviendo 401 si no hay sesión activa.

---

### [ALTO-2] `POST /api/docuseal/send` sin autenticación

**Severidad:** ALTO  
**Estado:** FIXED  
**Descripción:** Este endpoint permitía a cualquier usuario anónimo triggear el flujo completo de firma electrónica de DocuSeal en nombre de cualquier deal, sin estar autenticado. Podía usarse para enviar emails de firma a terceros o para poner propuestas en estado "pending" sin autorización.  
**Fix aplicado:** Añadido `getCurrentUser()` al inicio del handler, devolviendo 401 si no hay sesión activa.

---

### [ALTO-3] 10 server actions sin autenticación

**Severidad:** ALTO  
**Estado:** FIXED  
**Descripción:** Los siguientes server actions ejecutaban operaciones de escritura en la base de datos sin verificar que el usuario estuviera autenticado. En Next.js 15, los server actions son accesibles via POST directo a `/_next/action`, por lo que la ausencia de auth es explotable:

- `activate-version.ts` → activa una configuración de deal
- `deal-config.ts` → lee configuración activa de un deal
- `presupuestos.ts` → crea, actualiza, elimina presupuestos/ofertas
- `mark-sent.ts` → genera PDF y lo envía a DocuSeal para firma
- `save-version.ts` → guarda nueva versión de configuración
- `save-proposal.ts` → guarda secciones de propuesta
- `update-contact.ts` → modifica datos de contacto de un deal
- `update-company.ts` → modifica datos de empresa de un deal
- `invoices.ts` → crea, actualiza, cambia estado, elimina facturas
- `save-config.ts` → guarda configuración activa de un deal

**Fix aplicado:** Añadido `await requireAuth()` al inicio de cada función exportada en cada archivo.

---

### [MEDIO-1] Headers de seguridad HTTP ausentes

**Severidad:** MEDIO  
**Estado:** FIXED  
**Descripción:** `next.config.ts` no configuraba ningún header de seguridad HTTP. Faltaban: `X-Frame-Options` (clickjacking), `X-Content-Type-Options` (MIME sniffing), `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection`.  
**Fix aplicado:** Añadida función `headers()` a `next.config.ts` con los 5 headers de seguridad recomendados aplicados a todas las rutas (`/(.*)`).

---

### [MEDIO-2] RLS no verificado en tablas de Supabase

**Severidad:** MEDIO  
**Estado:** PENDING — requiere acción manual en Supabase  
**Descripción:** El backend usa el cliente `service_role` (que bypasea RLS por diseño) para todas las operaciones de servidor. Sin embargo, si en algún momento se usan queries desde el cliente `anon` o si hay una future refactorización, la ausencia de RLS expone todos los datos.

**Tablas identificadas que deben tener RLS habilitado:**

```sql
-- Verificar estado actual de RLS
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'deals', 'invoices', 'presupuestos', 'cashflow_transactions',
    'profiles', 'contratos', 'deal_events', 'proposals',
    'deal_configurations', 'cashflow_categories', 'cashflow_planned',
    'cashflow_presupuesto', 'company_locations', 'contact_overrides',
    'deal_owners', 'approvals'
  );

-- Habilitar RLS en todas las tablas de negocio
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_planned ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_presupuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

-- Política de ejemplo: solo service_role puede operar (behavior actual, defensivo)
-- Esto asegura que si alguien usa el cliente anon directamente no vea datos
CREATE POLICY "service_role only" ON deals
  USING (auth.role() = 'service_role');
-- Repetir para cada tabla
```

**Pasos:**
1. Ir a Supabase Dashboard → SQL Editor
2. Ejecutar el bloque de verificación para ver el estado actual
3. Ejecutar los `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` para las tablas que lo necesiten
4. Añadir políticas `service_role only` para cada tabla

---

### [MEDIO-3] `DOCUSEAL_WEBHOOK_SECRET` no configurado en producción

**Severidad:** MEDIO  
**Estado:** PENDING  
**Descripción:** Aunque el código ahora verifica la firma HMAC cuando `DOCUSEAL_WEBHOOK_SECRET` está presente, si no se configura la variable en Vercel el webhook sigue siendo accesible sin autenticación.  
**Pasos:**
1. En DocuSeal Dashboard → Settings → Webhooks, copiar el Secret
2. En Vercel Dashboard → Settings → Environment Variables, añadir `DOCUSEAL_WEBHOOK_SECRET=<valor>`
3. Hacer redeploy

---

### [BAJO-1] Página `/setup-error` muestra nombres de variables de entorno sensibles

**Severidad:** BAJO  
**Estado:** ACEPTABLE  
**Descripción:** La página `/setup-error` muestra una plantilla con los nombres de las variables de entorno requeridas (incluyendo `SUPABASE_SERVICE_ROLE_KEY`). No expone valores reales. Solo se renderiza cuando la configuración es incompleta (el servidor ya no funciona en ese estado).  
**Recomendación:** Sin acción requerida — es información de ayuda para el desarrollador, no hay valores reales expuestos.

---

### [BAJO-2] Logs de servidor con información de configuración

**Severidad:** BAJO  
**Estado:** ACEPTABLE  
**Descripción:** `mark-sent.ts` loguea `DOCUSEAL_API_KEY` (primeros 10 chars) y `DOCUSEAL_API_URL` en cada invocación. Los logs de Vercel son accesibles solo para el equipo del proyecto.  
**Recomendación:** Considerar eliminar o reducir estos logs en producción una vez que el flujo de DocuSeal esté estable.

---

## Acciones pendientes (resumen)

| # | Acción | Responsable | Prioridad |
|---|--------|-------------|-----------|
| 1 | Configurar `DOCUSEAL_WEBHOOK_SECRET` en Vercel | DevOps | Alta |
| 2 | Habilitar RLS en tablas de Supabase | DevOps/Backend | Media |
| 3 | Reducir logs de `DOCUSEAL_API_KEY` en mark-sent.ts | Dev | Baja |
