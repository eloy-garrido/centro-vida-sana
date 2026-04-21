function initProfessionalsAnimations() {
    const cards = document.querySelectorAll('.professional-card');
    const observer = new IntersectionObserver(entries => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('fade-in'), 180 * i);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    cards.forEach(card => observer.observe(card));
}

function initCardInteractions() {
    document.querySelectorAll('.professional-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const cx = rect.width / 2;
            const rotX = (e.clientY - rect.top - rect.height / 2) / 22;
            const rotY = (cx - (e.clientX - rect.left)) / 22;
            card.style.transform = `translateY(-10px) perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
}

function initContactButtonEffects() {
    document.querySelectorAll('.professional-contact-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.cssText = `
                position:absolute;border-radius:50%;pointer-events:none;
                width:${size}px;height:${size}px;
                left:${e.clientX - rect.left - size / 2}px;
                top:${e.clientY - rect.top - size / 2}px;
                background:rgba(255,255,255,.55);
                transform:scale(0);animation:ripple-anim .55s ease-out;
            `;
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });

    if (!document.getElementById('prof-ripple-style')) {
        const s = document.createElement('style');
        s.id = 'prof-ripple-style';
        s.textContent = '@keyframes ripple-anim{to{transform:scale(2.2);opacity:0}}';
        document.head.appendChild(s);
    }
}

function trackContactClick(name, channel) {
    if (typeof gtag === 'function') {
        gtag('event', 'contact_click', { professional: name, channel });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initProfessionalsAnimations();
    initCardInteractions();
    initContactButtonEffects();

    document.querySelectorAll('.professional-card').forEach(card => {
        const name = card.querySelector('.professional-name')?.textContent || '';
        card.querySelectorAll('.professional-contact-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                trackContactClick(name, btn.classList.contains('whatsapp') ? 'WhatsApp' : 'Teléfono');
            });
        });
    });
});
