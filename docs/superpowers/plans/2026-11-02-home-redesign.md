# Plan de Implementación: Nuevo Diseño Home en Astro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir y consolidar la nueva Home page de Centro Vida Sana Austral en Astro con Tailwind CSS, implementando la identidad cromática dual (Azul Petróleo Clásico para Quiropraxia y Verde Salvia para Acupuntura), microinteracciones y animaciones de alta gama (filosofía Emil Kowalski) y diseño contemporáneo, accesible y libre de elementos anticuados.

**Architecture:** Sitio estático Astro (`output: 'static'`) con componentes `.astro` modulares, estilos atómicos mediante Tailwind CSS y tokens personalizados, capa de datos tipada en TypeScript (`src/data/`), y scripts de cliente ligeros para microinteracciones fluidas (3D tilt, acordeón CSS Grid, selector de disciplina y botón flotante de WhatsApp).

**Tech Stack:** Astro 5, Tailwind CSS, TypeScript, WebP, WOFF2 (DM Sans + Playfair Display), Vercel.

**Spec:** `docs/superpowers/specs/2026-11-02-home-redesign.md`

## Global Constraints

- Identidad dual estricta: Quiropraxia = Azul Petróleo Clásico (`#134E5E`), Acupuntura = Verde Salvia (`#2E4D38`).
- Lienzo base claro y cálido: Lino mineral (`#F8F9F6`), sin fondos negros ni recortes de pasto.
- Animaciones con propósito: Usar curva elástica `--ease-spring: cubic-bezier(0.16, 1, 0.3, 1)` y `:active scale(0.97)`.
- Iconografía 100% SVG nítida (sin emojis como iconos de interfaz).
- Touch targets móviles >= 44×44px.
- Compatibilidad estricta con `output: 'static'` y despliegue en Vercel.

## Review Focus

1. **Rendimiento de animaciones:** Todas las animaciones deben usar `transform` y `opacity` para garantizar 60/120 fps sin repintados forzados (layout thrashing).
2. **Respuesta en dispositivos móviles (375px a 768px):** El selector dual del hero, las tarjetas profesionales y el botón flotante deben ser 100% utilizables con una sola mano.
3. **Consistencia de datos:** Los datos de profesionales, precios, teléfonos (+569 7370 0616 y +569 7388 8910) y dirección (Los Armiños 1620) deben provenir de `src/data/` centralizado.
4. **Respeto a accesibilidad (`prefers-reduced-motion`):** Las personas con sensibilidad al movimiento deben recibir transiciones suaves de opacidad sin giros 3D ni saltos.
5. **Cero dependencias pesadas en cliente:** No incluir React/Vue ni librerías de animación pesadas si CSS y JS vanilla resuelven el efecto con 0 KB de sobrecarga.

---

### Task 1: Inicialización de Proyecto Astro con Tailwind y Tokens

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tailwind.config.mjs`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Modify: `public/fonts/` (asegurar fuentes woff2 disponibles)

- [ ] **Paso 1.1:** Crear `package.json` con dependencias mínimas requeridas (`astro`, `@astrojs/tailwind`, `tailwindcss`, `typescript`).
- [ ] **Paso 1.2:** Configurar `astro.config.mjs` con integración de Tailwind y `output: 'static'`.
- [ ] **Paso 1.3:** Configurar `tailwind.config.mjs` registrando la paleta de tokens dual (petrol, sage, canvas-bg, text-primary, fonts).
- [ ] **Paso 1.4:** Crear `src/styles/tokens.css` y `src/styles/global.css` con variables CSS, tipografías `@font-face` locales y reset accesible.
- [ ] **Paso 1.5:** Instalar dependencias con `pnpm install` o `npm install` y verificar que `astro check` o `astro --version` funcione.
- [ ] **Paso 1.6:** Commit de inicialización de Astro: `git add . && git commit -m "chore: scaffold astro project with tailwind and dual tokens"`

---

### Task 2: Capa de Datos Tipada (`src/data/*.ts`)

**Files:**
- Create: `src/data/clinic.ts`
- Create: `src/data/professionals.ts`
- Create: `src/data/services.ts`
- Create: `src/data/pathologies.ts`
- Create: `src/data/faqs.ts`
- Create: `src/data/reviews.ts`

- [ ] **Paso 2.1:** Crear `clinic.ts` con datos institucionales (teléfonos, WhatsApp, dirección, horario, redes, geo).
- [ ] **Paso 2.2:** Crear `professionals.ts` con la información de Felipe Méndez y Eduardo Lagos (título, registro Minsal, bio sintetizada, especialidad, colores de marca).
- [ ] **Paso 2.3:** Crear `services.ts` categorizando cada servicio por disciplina, indicación, duración, precio referencial e icono SVG.
- [ ] **Paso 2.4:** Crear `pathologies.ts` con las 8 condiciones principales, disciplina recomendada y mensaje de WhatsApp preformateado.
- [ ] **Paso 2.5:** Crear `faqs.ts` con las 10 preguntas clave del schema explicadas con lenguaje empático y claro.
- [ ] **Paso 2.6:** Crear `reviews.ts` con los testimonios reales de Google Reviews 5.0.
- [ ] **Paso 2.7:** Commit de la capa de datos: `git add src/data && git commit -m "feat: add typed data models for clinic, professionals, services and faqs"`

---

### Task 3: BaseLayout, Navbar con Selector Dual y Footer

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/common/Navbar.astro`
- Create: `src/components/common/Footer.astro`

- [ ] **Paso 3.1:** Crear `BaseLayout.astro` configurando `<head>`, preloads de fuentes, etiquetas viewport, estilos globales y estructura semántica.
- [ ] **Paso 3.2:** Crear `Navbar.astro` con diseño flotante translúcido (`backdrop-blur-md`), logotipo minimalista, enlaces ancla, accesos rápidos Petróleo/Salvia y menú móvil interactivo.
- [ ] **Paso 3.3:** Crear `Footer.astro` sobrio y limpio en fondo lino/mineral, con información legal, enlaces a Minsal, Google Reviews y redes sociales.
- [ ] **Paso 3.4:** Probar el layout base renderizando una página mínima de prueba.
- [ ] **Paso 3.5:** Commit de layout y navegación: `git add src/layouts src/components/common && git commit -m "feat: add BaseLayout, responsive Navbar and Footer"`

---

### Task 4: Hero Dual Interactivo con Selector de Disciplina (`HeroDual.astro`)

**Files:**
- Create: `src/components/home/HeroDual.astro`

- [ ] **Paso 4.1:** Maquetar la cabecera editorial del Hero con tipografía `Playfair Display` ("Medicina Integral y Terapias Especializadas en Temuco").
- [ ] **Paso 4.2:** Construir el componente interactivo de Bifurcación Dual (Dual Split Hub) con dos paneles destacados:
  - Panel Quiropraxia & Kinesiología con acento Petróleo (`#134E5E`).
  - Panel Acupuntura & Med. China con acento Salvia (`#2E4D38`).
- [ ] **Paso 4.3:** Agregar microinteracción de cambio de foco (hover y active con transición suave y resalte de borde luminoso).
- [ ] **Paso 4.4:** Incluir barra de credenciales de confianza (Google 5.0, Certificación Minsal, Ubicación en Temuco).
- [ ] **Paso 4.5:** Commit del Hero Dual: `git add src/components/home/HeroDual.astro && git commit -m "feat: add interactive HeroDual component with split disciplines"`

---

### Task 5: Tarjetas de Profesionales con Efecto 3D Tilt (`DualProfessionals.astro`)

**Files:**
- Create: `src/components/home/DualProfessionals.astro`

- [ ] **Paso 5.1:** Diseñar tarjeta de Felipe Méndez con badges Petróleo, registro Minsal, foto nítida y botón de descarga de vCard.
- [ ] **Paso 5.2:** Diseñar tarjeta de Eduardo Lagos con badges Salvia, acreditación Minsal, foto nítida y botón de descarga de vCard.
- [ ] **Paso 5.3:** Implementar script de interacción 3D Tilt ligero y suave con acelerómetro de ratón (rotación máxima ±6°, brillo radial specular y retorno elástico en `mouseleave`).
- [ ] **Paso 5.4:** Verificar que en pantallas táctiles se desactive la rotación 3D y se mantenga una respuesta táctil limpia.
- [ ] **Paso 5.5:** Commit de sección de profesionales: `git add src/components/home/DualProfessionals.astro && git commit -m "feat: add DualProfessionals cards with 3D tilt interaction"`

---

### Task 6: Muestrario de Terapias con Filtro por Pestañas (`ServicesOverview.astro`)

**Files:**
- Create: `src/components/home/ServicesOverview.astro`

- [ ] **Paso 6.1:** Crear la barra de pestañas interactivas `[ Todas ]` · `[ Quiropraxia & Kinesiología ]` · `[ Acupuntura & Med. China ]` con pastilla deslizante animada.
- [ ] **Paso 6.2:** Renderizar tarjetas de servicio en un grid responsive de 3 columnas con precios transparentes, duración y beneficios tangibles.
- [ ] **Paso 6.3:** Implementar el filtrado instantáneo sin recarga de página mediante atributos `data-discipline`.
- [ ] **Paso 6.4:** Añadir efecto de hover sutil en tarjetas (elevación de 4px, borde con color de disciplina y retroalimentación activa en botón).
- [ ] **Paso 6.5:** Commit de servicios: `git add src/components/home/ServicesOverview.astro && git commit -m "feat: add ServicesOverview with interactive tab filtering"`

---

### Task 7: Guía Clínica de Dolencias ("¿Qué te duele?") (`PathologiesGuide.astro`)

**Files:**
- Create: `src/components/home/PathologiesGuide.astro`

- [ ] **Paso 7.1:** Maquetar la sección orientada a síntomas con encabezado empático.
- [ ] **Paso 7.2:** Construir tarjetas para cada dolencia (Lumbago, Cervicalgia, Ciática, Cefaleas, Estrés, etc.) con chips de color según la disciplina tratante.
- [ ] **Paso 7.3:** Vincular cada tarjeta con llamada a la acción directa que abre WhatsApp con el mensaje contextual pre-redactado.
- [ ] **Paso 7.4:** Commit de guía de dolencias: `git add src/components/home/PathologiesGuide.astro && git commit -m "feat: add PathologiesGuide interactive symptom cards"`

---

### Task 8: Preguntas Frecuentes, Reseñas, Academia y Botón Flotante

**Files:**
- Create: `src/components/home/FaqAccordion.astro`
- Create: `src/components/home/ReviewsSection.astro`
- Create: `src/components/home/StudyBanner.astro`
- Create: `src/components/home/ContactLocation.astro`
- Create: `src/components/common/FloatingWhatsApp.astro`
- Create: `src/pages/index.astro`

- [ ] **Paso 8.1:** Crear `FaqAccordion.astro` con animación fluida de altura mediante CSS Grid (`grid-template-rows: 0fr -> 1fr`) y rotación de icono elástica.
- [ ] **Paso 8.2:** Crear `ReviewsSection.astro` mostrando valoraciones verificadas de Google y enlace oficial a reseñas.
- [ ] **Paso 8.3:** Crear `StudyBanner.astro` para el curso de Medicina Tradicional China de Eduardo con estética refinada.
- [ ] **Paso 8.4:** Crear `ContactLocation.astro` con mapa con carga diferida, horarios y datos de contacto.
- [ ] **Paso 8.5:** Crear `FloatingWhatsApp.astro` (botón flotante en móviles que despliega opciones para hablar con Felipe o Eduardo).
- [ ] **Paso 8.6:** Ensamblar todas las secciones en `src/pages/index.astro`.
- [ ] **Paso 8.7:** Commit de componentes complementarios y Home: `git add src/ && git commit -m "feat: assemble complete Home page with FAQ, reviews, contact and floating WhatsApp"`

---

### Task 9: Verificación Visual, Build y Validación en Servidor Dev

**Files:**
- Verify: `astro.config.mjs`, `vercel.json`

- [ ] **Paso 9.1:** Ejecutar compilación estática `npm run build` (o `pnpm build`) y verificar que genera el bundle estático con 0 errores y 0 warnings bloqueantes.
- [ ] **Paso 9.2:** Levantar servidor de previsualización `npm run preview` y validar visualmente en escritorio y móvil (375px, 768px, 1200px).
- [ ] **Paso 9.3:** Comprobar microinteracciones: 3D tilt, selector de servicios, acordeón de FAQ, botón flotante y enlaces de WhatsApp.
- [ ] **Paso 9.4:** Commit final de verificación: `git add . && git commit -m "chore: verify build and polish responsive layout"`
