# Especificación Técnica de Diseño: Rediseño Home Centro Vida Sana Austral

**Fecha:** 2026-11-02  
**Proyecto:** Centro Vida Sana Austral ([centrovidasana.cl](https://centrovidasana.cl))  
**Rama Git:** `redesign-dual`  
**Tecnología:** Astro (Static Output) + Tailwind CSS + Vanilla TS Interaction  
**Estado:** Propuesta de Diseño Lista para Revisión  

---

## 1. Lectura de Diseño y Dirección Creativa (Taste Skill & Emil Kowalski)

> **Design Read:** Landing page para centro de salud integral en Temuco (Chile), orientada a pacientes que buscan alivio al dolor musculoesquelético y equilibrio sistémico. Lenguaje visual sobrio, editorial y bio-clínico de alto nivel, sustentado en una arquitectura cromática dual (Petróleo para Quiropraxia & Salvia para Acupuntura) sobre un lienzo lino cálido, con microinteracciones fluidas y cinemática sutil basada en la ingeniería de diseño de Emil Kowalski.

### Calibración de Diales (The Three Dials)
* **`DESIGN_VARIANCE: 7`** — Estructura asimétrica editorial, layout bento balanceado, alejándose del típico "template de clínica genérica" para transmitir prestigio y calidez humana.
* **`MOTION_INTENSITY: 7`** — Animaciones con propósito físico: transiciones basadas en curvas elásticas rápidas (`cubic-bezier(0.16, 1, 0.3, 1)`), retroalimentación táctil al presionar (`:active scale(0.97)`), gyro-tilt en tarjetas profesionales y acordeones sin salto de altura.
* **`VISUAL_DENSITY: 4`** — Generosos márgenes de respiro (padding de 80–120px en desktop), tipografía espaciada y jerarquía visual escaneable para personas que experimentan dolor o fatiga cognitiva.

### Principios Fundamentales
1. **La belleza es ventaja competitiva:** La mayoría de los sitios de kinesiología y medicina alternativa en la región se ven anticuados o caseros. Un diseño con tipografía editorial, fotografía cuidada y microinteracciones fluidas posiciona inmediatamente a la clínica en la cúspide de confianza.
2. **Los detalles invisibles se acumulan:** Cada botón debe confirmar al tacto que fue presionado; nada aparece de la nada (`scale(0.95)` a `scale(1)`); las fotos tienen sutiles luces especulares dinámicas.
3. **Cero saturación estridente:** Eliminamos el verde neón, el fondo negro y el recorte de pasto del sitio antiguo. Toda la paleta proviene de pigmentos minerales naturales.

---

## 2. Sistema de Tokens y Paleta Dual (Tailwind & CSS Variables)

```css
:root {
  /* Lienzo Común & Neutros */
  --canvas-bg: #F8F9F6;         /* Lino mineral cálido (elimina el blanco quirúrgico frío) */
  --surface-white: #FFFFFF;     /* Tarjetas elevadas */
  --surface-border: #E5E8E2;    /* Borde fino de alta definición */
  --surface-border-subtle: #ECEFE9;
  
  --text-primary: #151C17;      /* Grafito carbón profundo para títulos (contraste 12.8:1) */
  --text-secondary: #4A564D;    /* Gris slate vegetal para lectura */
  --text-muted: #7A877E;        /* Metadatos y etiquetas secundarias */

  /* Disciplina 1: Quiropraxia & Kinesiología (Felipe Méndez) */
  --petrol-900: #0B2B33;
  --petrol-800: #103E4A;
  --petrol-primary: #134E5E;    /* Petróleo Clásico insignia */
  --petrol-accent: #236B80;     /* Resalte hover */
  --petrol-light: #EBF4F6;      /* Fondo suave de pastillas y tags */
  --petrol-border: #C9DFE6;     /* Borde contenedor */

  /* Disciplina 2: Acupuntura & Medicina Tradicional China (Eduardo Lagos) */
  --sage-900: #15281D;
  --sage-800: #213C2B;
  --sage-primary: #2E4D38;      /* Verde Salvia Botánico insignia */
  --sage-accent: #497356;       /* Resalte hover */
  --sage-light: #EFF5F0;        /* Fondo suave de pastillas y tags */
  --sage-border: #D3E3D6;       /* Borde contenedor */

  /* Tipografías */
  --font-editorial: 'Playfair Display', Georgia, serif;
  --font-body: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Cinemática Emil Kowalski */
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);
  --duration-fast: 160ms;
  --duration-normal: 280ms;
  --duration-slow: 450ms;
}
```

---

## 3. Jerarquía y Experiencia de Secciones en `index.astro`

### A. Navbar (`Navbar.astro`)
* **Comportamiento:** Sticky con fondo translúcido y desenfoque (`backdrop-blur-md bg-white/80 border-b border-[#E5E8E2]`).
* **Elementos:**
  * Logotipo minimalista con isotipo circular del Centro Vida Sana Austral.
  * Selector dual central: botón tipo cápsula con dos estados `[ Quiropraxia ]` (resalte Petróleo) y `[ Acupuntura ]` (resalte Salvia) que actúan como anclas inteligentes con animación de pastilla deslizante.
  * Enlaces ancla: Profesionales, Terapias, Dolencias, Preguntas, Ubicación.
  * Botón CTA principal: *"Agendar Consulta"* con retroalimentación táctil `:active scale(0.97)`.
  * Menú hamburguesa accesible para smartphones con animación de apertura limpia.

### B. Hero Dual Interactivo (`HeroDual.astro`)
* **Titular H1 (SEO y Persuasión):**
  > *"Medicina Integral y Terapias Especializadas en Temuco"*
* **Subtítulo:**
  > *"Restauramos tu movilidad, aliviamos el dolor persistente y equilibramos tu salud con profesionales certificados por el Minsal."*
* **Bifurcador Interactivo (Dual Split Hub):**
  Dos paneles entrelazados con acentos interactivos:
  1. **Bloque Quiropraxia & Kinesiología (`#134E5E`):**
     * Indicador: *"Estructura, Columna y Movimiento"*
     * Puntos destacados: Ajuste vertebral específico, dolor lumbar y ciática, kinesiología en clínica y a domicilio.
     * Profesional a cargo: Felipe Méndez.
     * Enlace: *"Explorar Quiropraxia →"*
  2. **Bloque Acupuntura & Med. China (`#2E4D38`):**
     * Indicador: *"Equilibrio Energético y Alivio Sistémico"*
     * Puntos destacados: Manejo de dolor crónico, migrañas, estrés e insomnio, ventosas y moxibustión.
     * Profesional a cargo: Eduardo Lagos.
     * Enlace: *"Explorar Acupuntura →"*
* **Métricas de Autoridad:**
  * Insignia 5.0 Google Reviews (156+ valoraciones reales verificadas).
  * Profesionales inscritos en el Registro Nacional de Prestadores Individuales de Salud (Minsal).
  * Atención en Los Armiños 1620, Temuco.

### C. Presentación de Profesionales (`DualProfessionals.astro`)
* Dos tarjetas con diseño editorial médico de alta gama:
  * **Tarjeta Felipe Méndez (Petróleo):**
    * Retrato clínico profesional (`felipe-kinesiologo-400.webp`) con iluminación suave.
    * Título: *Quiropráctico & Kinesiólogo Certificado Minsal*.
    * Enfoque: Biomecánica, alineación vertebral, reinserción deportiva.
    * Botón de guardado de contacto directo (vCard `.vcf` nativo).
    * Botón directo de WhatsApp: *"Consultar con Felipe"*.
    * Efecto 3D Tilt interactivo (al pasar el ratón la tarjeta se inclina suavemente ±6° y genera un reflejo especular sutil).
  * **Tarjeta Eduardo Lagos (Salvia):**
    * Retrato clínico profesional (`eduardo-acupuntura-400.webp`).
    * Título: *Acupunturista Acreditado Minsal & Docente de MTC*.
    * Enfoque: Síndromes de dolor, cefaleas, equilibrio orgánico y auriculoterapia.
    * Botón de guardado de contacto directo (vCard `.vcf` nativo).
    * Botón directo de WhatsApp: *"Consultar con Eduardo"*.
    * Efecto 3D Tilt interactivo.

### D. Directorio de Terapias y Servicios (`ServicesOverview.astro`)
* **Selector por Pestañas:** `[ Todas ]` · `[ Quiropraxia & Kinesiología ]` · `[ Acupuntura & Medicina China ]`.
* Tarjetas limpias de superficie blanca con borde sutil y acento de color correspondiente.
* Cada servicio incluye:
  * Nombre formal de la terapia.
  * Para qué sirve y qué siente el paciente.
  * Duración típica (45 a 60 min).
  * Valor referencial transparente (\$20.000 a \$35.000 CLP).
  * Botón directo para agendar esa terapia vía WhatsApp.

### E. Guía de Dolencias y Patologías (`PathologiesGuide.astro`)
* Enfoque orientado 100% al paciente: *"¿Qué molestia o dolor estás experimentando?"*
* Grid de dolencias frecuentes:
  1. **Lumbago y Discopatías** → Etiqueta Petróleo (Quiropraxia)
  2. **Dolor Cervical y Tortícolis** → Etiqueta Petróleo (Quiropraxia)
  3. **Ciática Aguda** → Etiqueta Dual (Terapia Combinada)
  4. **Cefaleas Tensionales y Migrañas** → Etiqueta Salvia (Acupuntura)
  5. **Estrés, Ansiedad e Insomnio** → Etiqueta Salvia (Acupuntura)
  6. **Tendinopatías y Lesiones Deportivas** → Etiqueta Petróleo (Kinesiología)
  7. **Fibromialgia y Dolor Generalizado** → Etiqueta Dual (Terapia Combinada)
  8. **Artrosis y Rigidez Articular** → Etiqueta Dual
* Al hacer clic, abre WhatsApp con mensaje pre-redactado específico para esa condición.

### F. Preguntas Frecuentes Visibles (`FaqAccordion.astro`)
* Resuelve la inconsistencia SEO detectada: las 10 preguntas del schema JSON-LD ahora se muestran en pantalla mediante un acordeón accesible.
* **Cinemática:** Animación fluida de expansión usando CSS Grid (`grid-template-rows: 0fr -> 1fr`) sin saltos de layout.
* Las 10 preguntas cubren:
  1. Precios y formas de pago.
  2. Si la acupuntura es dolorosa.
  3. Diferencia entre quiropraxia y kinesiología.
  4. Número estimado de sesiones necesarias.
  5. Si se necesita orden o derivación médica.
  6. Cobertura de Fonasa / Isapres (boletas de reembolso).
  7. Ubicación y estacionamiento en Los Armiños 1620.
  8. Kinesiología y atención a domicilio.
  9. Acreditación de los profesionales ante el Minsal.
  10. Cómo agendar y cancelar horas.

### G. Formación y Academia (`StudyBanner.astro`)
* Módulo sobrio para el curso *"Fundamentos de Medicina Tradicional China y Teoría Yin Yang"* impartido por Eduardo Lagos.
* Detalle de certificación, modalidad y botón de contacto para postulaciones.

### H. Opiniones Reales y Reseñas (`ReviewsSection.astro`)
* Carrusel o grid de 6 testimonios representativos de pacientes reales de Temuco.
* Botón directo con enlace oficial a Google Local para verificar y escribir nuevas reseñas.

### I. Ubicación y Contacto (`ContactLocation.astro`)
* Mapa integrado con carga diferida (lazy load para no afectar los Core Web Vitals).
* Dirección exacta: Los Armiños 1620, Temuco.
* Horarios de atención: Lunes a Viernes de 10:00 a 21:00 hrs.
* Teléfonos con enlaces directos `tel:`.

### J. Botón Flotante en Móvil (`FloatingWhatsApp.astro`)
* Botón flotante discreto en la esquina inferior derecha.
* Al pulsar, despliega un menú animado estilo iOS/Emil Kowalski (`scale(0.95) -> scale(1)`):
  * 🔹 **Felipe Méndez** — Quiropraxia & Kinesiología
  * 🌿 **Eduardo Lagos** — Acupuntura & Medicina China

---

## 4. Estructura de Datos y Código en Astro

### Modelos de Datos Tipados (`src/data/`)
* `professionals.ts`: perfiles, credenciales, imágenes WebP, colores asociados.
* `services.ts`: catálogo de tratamientos con disciplina, precio, duración y descripción orientada al beneficio.
* `pathologies.ts`: lista de condiciones médicas con asignación de disciplina y mensaje personalizado de WhatsApp.
* `faqs.ts`: arreglo de preguntas y respuestas sincronizado con el schema SEO.
* `reviews.ts`: citas textuales, nombres de pacientes y puntaje.

---

## 5. Estrategia SEO y Marcado Schema.org

* `BaseLayout.astro` inyecta automáticamente:
  * Meta tags completos: Canonical, Hreflang es-CL, Open Graph (1200x630), Twitter Cards.
  * Schema consolidado:
    * `MedicalClinic` / `LocalBusiness` (nombre, geocoordenadas, teléfono, dirección).
    * `Person` para Felipe Méndez y Eduardo Lagos.
    * `FAQPage` sincronizado exactamente con el contenido de `FaqAccordion.astro`.
    * `AggregateRating` (5.0 / 156 reseñas).
* Metadatos con longitudes controladas:
  * `<title>`: 58 caracteres (evita truncamiento en Google SERP).
  * `<meta description>`: 142 caracteres (optimizado para visualización móvil sin puntos suspensivos).

---

## 6. Checklist de Calidad Pre-Entrega (UI/UX Pro Max)

- [ ] Cero emojis utilizados como iconos de interfaz (100% SVG nítidos y accesibles).
- [ ] Ratios de contraste WCAG AA/AAA verificados en todos los textos sobre fondos lino y blanco.
- [ ] Objetivos táctiles mínimos de 44x44px en todos los botones y enlaces móviles.
- [ ] Soporte para `prefers-reduced-motion` que desactiva las inclinaciones 3D y reemplaza traslaciones por opacidad suave.
- [ ] Fuentes WOFF2 autoalojadas para cero peticiones bloqueantes externas.
- [ ] Despliegue estático 100% compatible con Vercel.
