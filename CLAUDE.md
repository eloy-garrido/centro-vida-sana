# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Centro Vida Sana Austral** - Static website for a health clinic in Temuco, Chile offering acupuncture, chiropractic (quiropaxia), and kinesiology services.

- **Live URL**: https://centrovidasana.cl
- **Language**: Spanish (Chile)
- **Authors**: Felipe Méndez (+569 7370 0616) and Eduardo Lagos (+569 7388 8910)
- **Technology**: Vanilla HTML/CSS/JavaScript (no frameworks)

## Project Architecture

### Single-Page Structure
- **index.html**: Single HTML file containing all content (hero, professionals, services, pathologies, contact)
- **All-in-one approach**: No routing, no build process, direct deployment in Vercel
- **Progressive enhancement**: Works without JavaScript; enhanced with animations and interactions when JS loads

### Frontend Organization
```
├── index.html (main content)
├── js/
│   ├── script.js (navigation, scroll, contact cards, vCard)
│   └── professionals.js (animations for professional cards)
├── styles/ (component-based CSS files)
├── pix/ (images and media assets)
├── vercel.json (deployment configuration with headers, redirects, cache settings)
└── site.webmanifest (PWA configuration with clinic info)
```

### CSS Architecture
- **Component-based**: Each section has its own CSS file:
  - `core.css` (base, variables, utilities)
  - `animations.css` (keyframe animations)
  - `navbar.css`, `hero.css`, `services.css`, `professionals.css`, `pathologies.css`, `contact.css`, `footer.css`
  - `responsive.css` (all responsive breakpoints)
- **CSS variables**: Color scheme defined in `:root` with green palette
- **Design tokens**:
  - `--primary-green: #a8c5a0;`
  - `--dark-green: #7a9872;`
  - `--text-dark: #2d3e2d;`

### JavaScript Behavior
- **Smooth scroll**: All `a[href^="#"]` links scroll smoothly to sections
- **Intersection Observer**: Animates `.professional-card, .service-card, .pathology-item` on scroll
- **Contact interactions**: Location cards open Google Maps, phone cards trigger `tel:` links, vCard download for contact saving
- **Analytics**: Google Tag Manager events track contact clicks (requires `gtag` function)

## Custom Functionality

### Contact Cards (Hero)
- **Location card**: Opens Google Maps with saved coordinates (Los Armiños 1620, Temuco, Chile)
- **Phone card**: Initiates phone call with +56973700616
- **Click tracking**: Contact clicks send `gtag('event', 'contact_click')`

### Professional Cards
- **vCard Download**: `saveContactBtn` creates and downloads `Felipe_Mendez_Contacto.vcf` file
- **3D hover effect**: Cards tilt on mouse move (perspective transform)
- **Entry animations**: Cards fade in with staggered timing on scroll
- **Ripple effects**: Click animations that create expanding circles from click point

### Service & Pathology Cards
- Service cards show available treatments
- Pathology cards list conditions treated at the clinic

### SEO & Performance
- **JSON-LD structured data**: Rich LocalBusiness and MedicalClinic markup for Google
- **Advanced SEO**: Full meta tags (Open Graph, Twitter, canonical, breadcrumbs)
- **Service worker ready**: Vercel handles caching with aggressive headers
- **Image optimization**: WebP format with fallbacks, multi-size favicons
- **Security headers**: X-Frame-Options, X-XSS-Protection, Referrer-Policy (configured in vercel.json)

## Development Guidelines

### Testing Changes
- **No build step**: Changes are instant, just reload index.html
- **Open index.html** directly in browser for local testing
- **No dev server required**: Static file serving only
- **Test offline**: PWA should still load with `site.webmanifest` and cached resources

### CSS Changes
- **Component scope**: Edit specific .css files by section
- **Responsive design**: Mobile-first, test at 320px, 768px, 1024px, 1200px+ widths
- **Color consistency**: Always use CSS variables for colors
- **Animation performance**: Use `transform` and `opacity` for smooth animations

### JavaScript Changes
- **Progressive enhancement**: Test with JS disabled to ensure core functionality works
- **Intersection Observer**: Fallback applied if browser doesn't support it (cards show immediately)
- **vCard format**: Use correct vCard 3.0 syntax for contact downloads to work across devices
- **Analytics**: Check for `typeof gtag === 'function'` before calling to prevent errors without analytics

### Image Assets
- **Use WebP**: All images in pix/ should be WebP format (modern browsers)
- **Favicon suite**: Multiple formats/sizes required in root (ico, png, webp)
- **Responsive images**: Include multiple sizes when appropriate

### Deployment
- **Vercel static**: Deploy via `vercel.json` configuration
- **Headers configured**: Cache policies, security headers already set
- **Redirects**: index.html → /, and proper MIME types configured

## Key Features to Preserve

1. **Accessibility**: Maintain Spanish language (`lang="es"`), semantic HTML structure
2. **SEO Optimization**: Keep JSON-LD markup, meta tags, and heading hierarchy
3. **Performance**: Retain cache headers, WebP compression, efficient animations
4. **Contact Integration**: Preserve phone links, location mapping, vCard functionality
5. **Progressive Enhancement**: Ensure site works without JavaScript before adding enhancements
6. **Mobile UX**: Maintain smooth touch interactions and responsive layout

## Chile-Specific Context

- **Location**: Temuco, La Araucanía region, Chile
- **Phone format**: +569 prefix for mobile numbers (typical in Chile)
- **Address format**: Spanish street naming (Los Armiños 1620)
- **Business hours**: Follow typical Chile schedule, adjust meta tags accordingly
- **Regional SEO**: Optimize for "acupuntura Temuco", "quiropraxia Temuco", "kinesiología Temuco"
- **Currency**: Prices referenced should use CLP (Chilean Pesos), indicated in SEO markup as "$" (priceRange: "$$")

## No Testing Framework

This project has no automated tests, build pipeline, or CI/CD. Verification is manual:
- Visual confirmation across devices/browsers
- Interactive testing of contact cards
- SEO validation via Google Search Console
- PWA verification via Lighthouse test