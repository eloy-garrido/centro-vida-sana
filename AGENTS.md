# Centro Vida Sana Austral - AGENTS.md

## Project Overview

**Centro Vida Sana Austral** - Static website for a health clinic in Temuco, Chile offering acupuncture, chiropractic (quiropaxia), and kinesiology services.

- **Live URL**: https://centrovidasana.cl
- **Language**: Spanish (Chile)
- **Authors**: Felipe Méndez (+569 7370 0616) and Eduardo Lagos (+569 7388 8910)
- **Technology**: Vanilla HTML/CSS/JavaScript (no frameworks)

---

## File Structure

```
/
├── index.html              # Main single-page application
├── js/
│   ├── script.js          # Navigation, scroll, contact cards, vCard
│   └── professionals.js # Animations for professional cards
├── styles/
│   ├── core.css          # Base, variables, utilities
│   ├── animations.css   # Keyframe animations
│   ├── navbar.css      # Navigation bar styles
│   ├── hero.css        # Hero section styles
│   ├── services.css     # Service cards (gallery)
│   ├── professionals.css # Professional cards
│   ├── pathologies.css # Pathology cards
│   ├── contact.css     # Contact section
│   ├── footer.css     # Footer styles
│   └── responsive.css # Responsive breakpoints
├── pix/                  # Images (WebP format)
│   ├── kine/           # Kinesiology images
│   └── mtc/            # Traditional Chinese medicine images
├── sitemap.xml           # XML sitemap
├── vercel.json          # Vercel deployment config
└── site.webmanifest    # PWA manifest
```

---

## Color Palette

```css
--primary-green: #a8c5a0;   /* Main green */
--light-green: #c9d9c3;    /* Light variant */
--dark-green: #7a9872;      /* Dark variant */
--accent-green: #8fb185;   /* Accent */
--text-dark: #2d3e2d;     /* Text color */
--text-light: #f5f5f0;     /* Light text */
--bg-light: #f8faf8;     /* Background */
```

---

## Sections

### 1. Hero (#hero)
- Logo and clinic name
- Main services: Acupuncture, Kinesiología, Quiropraxia
- Call-to-action buttons
- Contact cards (phone, location)

### 2. Professionals (#profesionales)
- Eduardo Lagos: Acupunturista Certificado por Minsal
- Felipe Méndez: Quiropráctico y Kinesiólogo

### 3. Services (#servicios)
- Kinesiología & Quiropraxia group (6 treatments)
- Acupuntura & Medicina China group (6 treatments)

### 4. Pathologies (#patologias)
- 8 conditions treated
- Links to WhatsApp for consultation

### 5. Contact (#contacto)
- Phone numbers with tel: links
- Address: Los Armiños 1620, Temuco
- Google Maps integration
- Review prompt for Google

---

## SEO Features

- JSON-LD Schema: LocalBusiness, MedicalClinic, FAQPage, BreadcrumbList, Organization, Person
- Open Graph: title, description, image, url, locale: es_CL
- Twitter Cards: summary_large_image
- Meta tags: description, keywords, robots, canonical
- Business Hours: Monday-Friday 10:00-21:00
- Coordinates: -38.7381, -72.5898

---

## Animations

### Current Hover Effects
- **Service Cards**: translateY(-6px) + zoom image on hover
- **Professional Cards**: translateY(-8px) + enhanced shadow
- **Buttons**: color change + lift effect
- **Images**: scale(1.08) on hover

### Keyframe Animations
- fadeInUp: Entry animations
- float: Floating decorative leaves
- floatRotate: Leaf rotation
- leafFall: Decorative falling leaves
- bounce: Scroll indicator

---

## Deployment

- **Platform**: Vercel
- **Build**: None (static files)
- **Cache**: Aggressive headers for images
- **Security**: X-Frame-Options, X-XSS-Protection, Referrer-Policy

---

## Development Commands

### Local Testing
```bash
# Start local server
python3 -m http.server 8080

# Open in browser
open index.html
```

### Image Optimization
```bash
# Convert to WebP
convert input.png -quality 80 output.webp

# Resize for responsive
convert image.webp -resize 400x image-400.webp
```

---

## Accessibility

- `lang="es"` maintained
- Semantic HTML (article, section, nav)
- ARIA labels on interactive elements
- prefers-reduced-motion support

---

## Recent Changes

- SEO audit (score: 87.7/100)
- Image optimization (~160KB savings)
- Sitemap fixed (removed # URLs)
- srcset added to professional photos
- Animations improved with subtle hover effects