/**
 * PROFESSIONALS SECTION - Animaciones e Interacciones
 * Este archivo maneja todas las animaciones e interacciones
 * específicas para la sección de Nuestros Profesionales
 */

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    initProfessionalsAnimations();
    initCardInteractions();
    initContactButtonEffects();
});

/**
 * Inicializa las animaciones de aparición de las tarjetas
 * Usa Intersection Observer para animar cuando entran en viewport
 */
function initProfessionalsAnimations() {
    const cards = document.querySelectorAll('.professional-card');

    // Configurar Intersection Observer
    const observerOptions = {
        threshold: 0.2,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Agregar delay escalonado para efecto de cascada
                setTimeout(() => {
                    entry.target.classList.add('fade-in');
                }, index * 200);

                // Dejar de observar una vez animado
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observar cada tarjeta
    cards.forEach(card => {
        observer.observe(card);
    });
}

/**
 * Agrega efectos de paralaje sutil al mover el mouse
 * sobre las tarjetas de profesionales
 */
function initCardInteractions() {
    const cards = document.querySelectorAll('.professional-card');

    cards.forEach(card => {
        // Efecto de inclinación 3D en hover
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            card.style.transform = `
                translateY(-15px)
                scale(1.02)
                perspective(1000px)
                rotateX(${rotateX}deg)
                rotateY(${rotateY}deg)
            `;
        });

        // Resetear transformación al salir
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });

        // Efecto de vibración suave en avatar al hacer hover en la tarjeta
        card.addEventListener('mouseenter', () => {
            const avatar = card.querySelector('.professional-avatar');
            avatar.classList.add('pulse-animation');

            setTimeout(() => {
                avatar.classList.remove('pulse-animation');
            }, 600);
        });
    });

    // Agregar la animación de pulso al CSS dinámicamente
    if (!document.getElementById('professionals-dynamic-styles')) {
        const style = document.createElement('style');
        style.id = 'professionals-dynamic-styles';
        style.textContent = `
            @keyframes pulse-animation {
                0%, 100% { transform: scale(1.15) rotate(5deg); }
                50% { transform: scale(1.2) rotate(5deg); }
            }
            .pulse-animation {
                animation: pulse-animation 0.6s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Efectos especiales para los botones de contacto
 */
function initContactButtonEffects() {
    const contactButtons = document.querySelectorAll('.professional-contact-btn');

    contactButtons.forEach(button => {
        // Efecto de ondas al hacer clic (ripple effect)
        button.addEventListener('click', function(e) {
            // Crear elemento de onda
            const ripple = document.createElement('span');
            ripple.classList.add('ripple-effect');

            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            this.appendChild(ripple);

            // Eliminar el elemento después de la animación
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });

        // Efecto de "shine" aleatorio cada cierto tiempo
        setInterval(() => {
            if (Math.random() > 0.7) { // 30% de probabilidad
                button.classList.add('shine-effect');
                setTimeout(() => {
                    button.classList.remove('shine-effect');
                }, 1000);
            }
        }, 5000);
    });

    // Agregar estilos para el efecto ripple y shine
    if (!document.getElementById('button-effects-styles')) {
        const style = document.createElement('style');
        style.id = 'button-effects-styles';
        style.textContent = `
            .ripple-effect {
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.6);
                transform: scale(0);
                animation: ripple-animation 0.6s ease-out;
                pointer-events: none;
            }

            @keyframes ripple-animation {
                to {
                    transform: scale(2);
                    opacity: 0;
                }
            }

            .shine-effect {
                animation: shine-animation 1s ease-in-out;
            }

            @keyframes shine-animation {
                0% { filter: brightness(1); }
                50% { filter: brightness(1.2); }
                100% { filter: brightness(1); }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Efecto de partículas flotantes en el fondo (opcional)
 * Se puede activar/desactivar según preferencia
 */
function initBackgroundParticles() {
    const section = document.querySelector('.professionals');
    if (!section) return;

    // Crear contenedor de partículas
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'professionals-particles';
    particlesContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
    `;

    // Crear múltiples partículas
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const size = Math.random() * 8 + 4;
        const startX = Math.random() * 100;
        const duration = Math.random() * 15 + 10;
        const delay = Math.random() * 5;

        particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            left: ${startX}%;
            bottom: -20px;
            animation: float-up ${duration}s ease-in ${delay}s infinite;
            filter: blur(2px);
        `;

        particlesContainer.appendChild(particle);
    }

    section.insertBefore(particlesContainer, section.firstChild);

    // Agregar animación de flotación
    if (!document.getElementById('particles-styles')) {
        const style = document.createElement('style');
        style.id = 'particles-styles';
        style.textContent = `
            @keyframes float-up {
                0% {
                    transform: translateY(0) translateX(0);
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                90% {
                    opacity: 1;
                }
                100% {
                    transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Descomentar la siguiente línea si deseas activar las partículas de fondo
// initBackgroundParticles();

/**
 * Analytics tracking para clicks en botones de contacto
 * (Opcional - para futuras implementaciones de analytics)
 */
function trackContactClick(professional, contactType) {
    console.log(`Contacto iniciado: ${professional} - ${contactType}`);
    // Aquí se puede integrar Google Analytics, Meta Pixel, etc.
    // Ejemplo: gtag('event', 'contact_click', { professional, contactType });
}

// Agregar tracking a los botones
document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.professional-card');

    cards.forEach(card => {
        const professionalName = card.querySelector('.professional-name')?.textContent || 'Desconocido';
        const buttons = card.querySelectorAll('.professional-contact-btn');

        buttons.forEach(button => {
            button.addEventListener('click', function() {
                const contactType = this.classList.contains('whatsapp') ? 'WhatsApp' : 'Teléfono';
                trackContactClick(professionalName, contactType);
            });
        });
    });
});
