# Centro Vida Sana Austral — Guía para agentes

## Proyecto

Sitio público de un centro de salud de Temuco, Chile, con servicios de acupuntura, medicina china, quiropraxia y kinesiología.

- **Producción:** https://centrovidasana.cl
- **Idioma:** español de Chile (`lang="es"`)
- **Stack actual:** Astro 5, salida estática, Tailwind CSS 3 y TypeScript
- **Profesionales:** Eduardo Lagos (acupuntura/MTC) y Felipe Méndez (quiropraxia/kinesiología)
- **Dirección:** Los Armiños 1620, Temuco
- **Zona horaria de negocio:** `America/Santiago`

## Fuente de verdad

El sitio activo se desarrolla en `src/`. Astro genera `dist/`, que no se edita manualmente.

En la raíz todavía existen `index.html`, `styles/`, `js/` y parte de `pix/` como archivos del sitio estático anterior. No mezclar cambios entre esa versión heredada y Astro. Los recursos públicos utilizados por Astro se copian desde `public/`.

## Estructura principal

```text
src/
├── components/
│   ├── common/          # Navbar, footer, WhatsApp y FAQ
│   ├── home/            # Secciones de la portada
│   └── professionals/   # Perfil profesional reutilizable
├── data/                # Clínica, profesionales, servicios, FAQ, etc.
├── layouts/BaseLayout.astro
├── pages/               # Home, servicios y perfiles profesionales
└── styles/              # Tokens y estilos globales
public/                  # Imágenes, fuentes, manifest, robots y sitemap
scripts/                 # Herramientas de la versión estática heredada
docs/                    # Especificaciones y planificación
.opencode/agents/        # Agentes especializados del proyecto
```

### Datos reutilizables

- `src/data/clinic.ts`: identidad, contacto, dirección y horarios.
- `src/data/professionals.ts`: perfiles, áreas, fotografías y enlaces.
- `src/data/services.ts`: catálogo de tratamientos.
- `src/data/faqs.ts`, `pathologies.ts`, `reviews.ts`: contenido estructurado.

Reutilizar estos datos en las nuevas pantallas de reservas en lugar de duplicarlos.

## Comandos

```bash
npm run dev       # Servidor local de Astro
npm run build     # Build estático en dist/
npm run preview   # Previsualizar el build
```

No hay framework de pruebas ni script `test` configurado actualmente. No afirmar que una prueba pasó si no fue ejecutada. `npm run build` es la verificación mínima para cambios del frontend.

## Diseño y frontend

- Fuentes autoalojadas: Playfair Display para titulares y DM Sans para texto.
- Paleta principal definida en `tailwind.config.mjs` y `src/styles/tokens.css`:
  - Quiropraxia/kinesiología: azul petróleo (`#134E5E`).
  - Acupuntura/MTC: verde salvia (`#2E4D38`).
  - Fondo lino: `#F8F9F6`; texto principal: `#151C17`.
- Mantener HTML semántico, teclado, foco visible, contraste, objetivos táctiles y `prefers-reduced-motion`.
- Preferir componentes Astro y TypeScript/JavaScript ligero. No añadir otro framework sin necesidad demostrada.
- Conservar SEO, canonicals, Open Graph y JSON-LD de `BaseLayout.astro` al crear páginas.
- Las rutas de reservas y el panel profesional deben usar `noindex`; el contenido público existente debe seguir siendo indexable.

## Agendamiento futuro

El alcance funcional entregado por el usuario está en **`docs/agendamiento/contexto.md`**. Leerlo antes de diseñar o modificar reservas.

Decisiones que no deben omitirse:

1. Google OAuth se usa solo para identidad; no integrar API de Calendar ni OAuth offline de una cuenta clínica.
2. Las dos agendas propias usan D1 como fuente oficial y permiten atenciones simultáneas; no enviar correos. El enlace a calendario personal crea una copia manual sin sincronización.
3. El reservante y el paciente pueden ser personas distintas; nombre, correo y RUT atendido son editables.
4. La disponibilidad, los roles y la confirmación se validan en servidor.
5. Consultar disponibilidad no bloquea un cupo: hacen falta idempotencia y protección explícita contra dobles reservas.
6. Cloudflare alojará frontend/backend y D1; trabajar localmente antes de cualquier mutación remota aprobada. Specs vigentes: `docs/agendamiento/specs/`, planes por módulo y maestro: `docs/agendamiento/planes/`, decisiones D01–D09: `docs/agendamiento/decisiones.md`. Solo `historico/` y evaluación inicial son antecedentes no ejecutables. Los specs/planes no conceden autorización remota.
7. No almacenar RUT, tokens ni datos personales en `localStorage`, URLs, analítica o logs.

El administrador y ambos profesionales pueden gestionar las dos agendas mediante pestañas, incluidas creación, edición y cancelación/eliminación de horas. Los permisos se comprueban en servidor y cada acción identifica al usuario actuante. Cancelación/reprogramación autónoma por pacientes, pagos, historia clínica y recordatorios quedan fuera del MVP salvo solicitud expresa.

## Agentes OpenCode

Los agentes se descubren automáticamente desde `.opencode/agents/`:

| Agente | Modo | Responsabilidad |
|---|---|---|
| `coordinador` | Principal | Planifica, delega, integra y verifica entregas |
| `frontend-reservas` | Subagente | UI Astro, pasos, accesibilidad e integración HTTP |
| `backend-reservas` | Subagente | Cloudflare D1, OAuth de identidad, persistencia y concurrencia |
| `revisor-reservas` | Subagente | Revisión read-only de seguridad, privacidad y regresiones |
| `qa-reservas` | Subagente | Build, pruebas de negocio y E2E |

Ejemplos:

```text
Usa el agente coordinador para planificar el MVP de agendamiento.
Usa frontend-reservas para crear el selector de profesionales.
Usa revisor-reservas para auditar la confirmación de reservas.
```

El coordinador debe usar especialistas solo cuando aporten valor y entregarles contexto completo. Los subagentes comienzan sin el historial de la conversación principal.

## Seguridad y cambios

- **Lectura obligatoria antes de MCP/CLI/API:** `docs/agendamiento/seguridad-cloudflare.md` y `cloudflare-staging.md`. Única cuenta `21c858ed53ec9083b6fcd89d18c27372`, Worker `vida-sana-reservas-staging`, D1 UUID `3d91d453-2ef5-4601-80cf-27622a0787bf`, binding `DB` a ese UUID. Pasar cuenta/recurso explícitos; ante discrepancia detenerse, nunca escoger por defecto.
- La creación inicial está terminada y no autoriza más mutaciones. Migraciones/deploys/secretos requieren aprobación nueva y acotada. Mantener workers.dev/previews deshabilitados hasta aprobación específica. No tocar DNS, dominios, otros proyectos/cuentas, permisos, facturación, producción ni recursos nuevos; no explorar datos ajenos. No borrar/restaurar/recrear recursos sin autorización específica.
- Incluir la frontera completa en cada delegación remota. Frontend/QA trabajan localmente; el revisor no realiza mutaciones. Ningún agente puede ampliar permisos/inventario para autorizarse a sí mismo. Las reglas son operativas: no afirmar que el MCP está limitado técnicamente a esos recursos.
- No guardar credenciales reales en el repositorio ni en documentación.
- No ejecutar despliegues, migraciones remotas ni mutaciones Git sin autorización explícita.
- Revisar `git status` y los diffs antes de editar; conservar cambios del usuario.
- Hacer cambios mínimos y actualizar esta guía cuando cambien estructura, comandos o arquitectura.
- Para autenticación, autorización o persistencia, terminar con revisión y pruebas de concurrencia/roles.
