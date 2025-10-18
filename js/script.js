// ============================================
// SMOOTH SCROLL
// ============================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ============================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ============================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all professional cards, service cards, pathology items, and sections
document.querySelectorAll('.professional-card, .service-card, .pathology-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// ============================================
// CONTACT CARDS - CLICK TO ACTION
// ============================================

const contactCards = document.querySelectorAll('.hero .contact-card');

contactCards.forEach((card, index) => {
    card.addEventListener('click', () => {
        if (index === 0) {
            // Location card - open Google Maps
            const address = encodeURIComponent('Los Armiños 1620, Temuco, Chile');
            window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
        } else if (index === 1) {
            // Phone card - call
            window.location.href = 'tel:+56973700616';
        }
    });
});

// Location card in contact section
const locationCard = document.getElementById('locationCard');
if (locationCard) {
    locationCard.addEventListener('click', () => {
        const address = encodeURIComponent('Los Armiños 1620, Temuco, Chile');
        window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
    });
}

// ============================================
// SAVE CONTACT FUNCTIONALITY
// ============================================

const saveContactBtn = document.getElementById('saveContactBtn');

if (saveContactBtn) {
    saveContactBtn.addEventListener('click', () => {
        // Create vCard data
        const vCardData = `BEGIN:VCARD
VERSION:3.0
FN:Felipe Méndez
TITLE:Quiropráctico / Kinesiólogo
TEL;TYPE=CELL:+56973700616
ADR;TYPE=WORK:;;Los Armiños 1620;Temuco;;;Chile
URL:${window.location.href}
END:VCARD`;

        // Create blob and download
        const blob = new Blob([vCardData], { type: 'text/vcard;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Felipe_Mendez_Contacto.vcf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Show notification
        showNotification('✓ Contacto guardado exitosamente', 'success');
    });
}

// ============================================
// SHARE FUNCTIONALITY
// ============================================

const shareBtn = document.getElementById('shareBtn');

if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
        const shareData = {
            title: 'Felipe Méndez - Quiropráctico / Kinesiólogo',
            text: 'Contacta a Felipe Méndez\n\nQuiropráctico / Kinesiólogo\nLos Armiños 1620, Temuco\nTeléfono: +569 7370 0616',
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                showNotification('✓ Compartido exitosamente', 'success');
            } else {
                // Fallback: Copy to clipboard
                const textToCopy = `${shareData.title}\n\n${shareData.text}\n\n${shareData.url}`;
                await navigator.clipboard.writeText(textToCopy);
                showNotification('✓ Información copiada al portapapeles', 'success');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                showNotification('✗ Error al compartir', 'error');
            }
        }
    });
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Add notification styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 18px 28px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #a8c5a0, #7a9872)' : '#d97070'};
        color: white;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 10000;
        font-size: 16px;
        font-weight: 600;
        animation: slideInRight 0.4s ease-out;
        max-width: 320px;
        word-wrap: break-word;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds with fade out
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.4s ease-out';
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

// Add slideout animation
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// LOGO INTERACTIONS
// ============================================

const logoImages = document.querySelectorAll('.logo-image, .logo-footer, .yinyang-logo');

logoImages.forEach(logo => {
    logo.addEventListener('click', (e) => {
        e.stopPropagation();

        // For yin-yang logo, stop its rotation temporarily and do a fast spin
        if (logo.classList.contains('yinyang-logo')) {
            logo.style.animation = 'none';
            logo.style.transition = 'transform 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            logo.style.transform = 'rotate(720deg) scale(1.1)';
            setTimeout(() => {
                logo.style.transform = 'rotate(0deg) scale(1)';
                setTimeout(() => {
                    logo.style.animation = 'rotate 20s linear infinite';
                }, 800);
            }, 800);
        } else {
            // Regular logos do a simple 360 rotation
            logo.style.transition = 'transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            logo.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                logo.style.transform = 'rotate(0deg)';
            }, 600);
        }
    });
});

// ============================================
// SCROLL PROGRESS INDICATOR
// ============================================

window.addEventListener('scroll', () => {
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        const scrolled = window.scrollY;
        if (scrolled > 100) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.pointerEvents = 'none';
        } else {
            scrollIndicator.style.opacity = '1';
            scrollIndicator.style.pointerEvents = 'auto';
        }
    }
});

// ============================================
// SERVICE CARDS - ENHANCED HOVER EFFECTS
// ============================================

const serviceCards = document.querySelectorAll('.service-card');

serviceCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    });

    // Add ripple effect on click
    card.addEventListener('click', function(e) {
        const ripple = document.createElement('div');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: rgba(168, 197, 160, 0.3);
            left: ${x}px;
            top: ${y}px;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    });
});

// Add ripple animation
if (!document.getElementById('ripple-styles')) {
    const rippleStyle = document.createElement('style');
    rippleStyle.id = 'ripple-styles';
    rippleStyle.textContent = `
        @keyframes ripple {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(rippleStyle);
}

// ============================================
// PATHOLOGY ITEMS - STAGGERED ANIMATION
// ============================================

const pathologyItems = document.querySelectorAll('.pathology-item');

const pathologyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }, index * 50); // Stagger by 50ms
        }
    });
}, { threshold: 0.1 });

pathologyItems.forEach(item => {
    pathologyObserver.observe(item);
});

// ============================================
// PARALLAX EFFECT FOR HERO BACKGROUND
// ============================================

window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const leafFloats = document.querySelectorAll('.leaf-float');

    leafFloats.forEach((leaf, index) => {
        const speed = 0.5 + (index * 0.2);
        leaf.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// ============================================
// SECTION FADE-IN ON SCROLL
// ============================================

// Animation removed for pathologies section

// ============================================
// KEYBOARD NAVIGATION
// ============================================

document.addEventListener('keydown', (e) => {
    // Press 'H' to go to hero
    if (e.key === 'h' || e.key === 'H') {
        document.getElementById('hero').scrollIntoView({ behavior: 'smooth' });
    }
    // Press 'E' to go to professionals (Equipo)
    if (e.key === 'e' || e.key === 'E') {
        document.getElementById('profesionales').scrollIntoView({ behavior: 'smooth' });
    }
    // Press 'S' to go to services
    if (e.key === 's' || e.key === 'S') {
        document.getElementById('servicios').scrollIntoView({ behavior: 'smooth' });
    }
    // Press 'P' to go to pathologies
    if (e.key === 'p' || e.key === 'P') {
        document.getElementById('patologias').scrollIntoView({ behavior: 'smooth' });
    }
    // Press 'C' to go to contact
    if (e.key === 'c' || e.key === 'C') {
        document.getElementById('contacto').scrollIntoView({ behavior: 'smooth' });
    }
});

// ============================================
// PAGE LOAD ANIMATION
// ============================================

window.addEventListener('load', () => {
    // Fade in hero content
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.style.opacity = '0';
        setTimeout(() => {
            heroContent.style.transition = 'opacity 1s ease';
            heroContent.style.opacity = '1';
        }, 100);
    }

    // Console welcome message
    console.log('%c🌿 Consulta Vida Sana Austral', 'color: #a8c5a0; font-size: 20px; font-weight: bold; padding: 10px;');
    console.log('%cCentro de Salud Integral y Bienestar', 'color: #7a9872; font-size: 14px;');
    console.log('%c\nAtajos de teclado:\nH - Inicio\nE - Equipo\nS - Servicios\nP - Patologías\nC - Contacto', 'color: #8fb185; font-size: 12px;');
});

// ============================================
// PREVENT ANIMATIONS ON PAGE RESIZE
// ============================================

let resizeTimer;
window.addEventListener('resize', () => {
    document.body.classList.add('resize-animation-stopper');
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        document.body.classList.remove('resize-animation-stopper');
    }, 400);
});

// Add CSS to stop animations during resize
if (!document.getElementById('resize-styles')) {
    const resizeStyle = document.createElement('style');
    resizeStyle.id = 'resize-styles';
    resizeStyle.textContent = `
        .resize-animation-stopper * {
            animation: none !important;
            transition: none !important;
        }
    `;
    document.head.appendChild(resizeStyle);
}

// ============================================
// NAVBAR FUNCTIONALITY
// ============================================

const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav-link');

// Toggle mobile menu
navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navbar.contains(e.target)) {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
    }
});

// Add scrolled class to navbar on scroll
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Highlight active section in navbar
const sections = document.querySelectorAll('section[id]');

function highlightNavLink() {
    const scrollY = window.scrollY + 100;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);

        if (navLink && scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            navLinks.forEach(link => link.classList.remove('active'));
            navLink.classList.add('active');
        }
    });
}

window.addEventListener('scroll', highlightNavLink);
window.addEventListener('load', highlightNavLink);
