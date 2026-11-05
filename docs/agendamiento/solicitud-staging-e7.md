# Solicitud de Aprobación para Staging (Entrega E7)

Conforme a la política de seguridad obligatoria ([seguridad-cloudflare.md](seguridad-cloudflare.md)), **ningún despliegue ni migración remota puede ejecutarse sin la autorización explícita y separada del usuario**.

---

## 1. Perímetro y Destinos Exactos de Staging

| Parámetro | Valor Autorizado en Allowlist |
|---|---|
| **Cuenta Cloudflare** | `21c858ed53ec9083b6fcd89d18c27372` |
| **Worker** | `vida-sana-reservas-staging` |
| **Base de Datos D1** | `vida-sana-reservas-staging` |
| **UUID D1** | `3d91d453-2ef5-4601-80cf-27622a0787bf` |
| **Binding D1** | `DB` |
| **Exposición Pública** | **Deshabilitada** (`workers_dev: false`, `preview_urls: false`) |
| **Dominio / DNS** | **Ninguno** (No se toca el dominio de producción `centrovidasana.cl`) |

---

## 2. Lote de Migración SQL Propuesto

- **Archivo a ejecutar remotamente:** `migrations/0001_initial_schema.sql`
- **Efecto sobre datos:**
  - Crea tablas: `users`, `sessions`, `oauth_attempts`, `team_members`, `professionals`, `patient_profiles`, `agenda_entries`, `command_results`, `audit_events`.
  - Instala triggers de exclusión atómica de solapamientos: `trg_agenda_entries_no_overlap_insert` y `trg_agenda_entries_no_overlap_update`.
  - Inserta los dos profesionales oficiales: Felipe Méndez (`felipe`) y Eduardo Lagos (`eduardo`).
  - Inserta el miembro inicial del equipo: `centrovida.sanaaustral@gmail.com` con rol `admin`.
- **Comando remoto propuesto (requiere autorización previa):**
  ```bash
  npx wrangler d1 execute vida-sana-reservas-staging --remote --file=migrations/0001_initial_schema.sql
  ```

---

## 3. Lote de Despliegue del Worker Propuesto

- **Archivo de configuración:** `infra/cloudflare-staging/wrangler.jsonc`
- **Entrada del Worker:** Worker que sirve la API `/api/*` conectada al binding `DB` de D1 y los archivos estáticos generados por Astro en `dist/`.
- **Comando de despliegue propuesto (requiere autorización previa):**
  ```bash
  npx wrangler deploy --config=infra/cloudflare-staging/wrangler.jsonc
  ```

---

## 4. Estado Actual y Puertas Pendientes

1. **Implementación Local Completa:** Entregas E1 a E6 finalizadas con éxito (39/39 tests aprobados, build Astro 100% limpio).
2. **Servidor Local Activo:** Puedes probar y ver ambas interfaces ahora mismo en tu navegador:
   - Pasarela del paciente: [http://localhost:4321/reservar](http://localhost:4321/reservar)
   - Panel de agenda del equipo: [http://localhost:4321/agenda](http://localhost:4321/agenda)
3. **Pausa Operativa Obligatoria:** De acuerdo al plan maestro, nos detenemos aquí a la espera de que revises localmente y nos indiques si deseas autorizar la ejecución remota del lote de staging o si prefieres realizar ajustes adicionales.
