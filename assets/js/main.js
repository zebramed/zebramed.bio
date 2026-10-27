// Site behaviour that is not figure motion: header, navigation, logo carousel.
// Figure motion lives in motion.js.
document.addEventListener('DOMContentLoaded', function () {

    // --- Seamless logo carousel ---
    const initSeamlessCarousel = async () => {
        const carouselTrack = document.querySelector('.carousel-track');
        if (!carouselTrack) return;
        const slide = carouselTrack.querySelector('.carousel-slide');
        if (!slide) return;

        const images = slide.querySelectorAll('img');
        await Promise.all([...images].map(img => new Promise(resolve => {
            if (img.complete) return resolve();
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        })));

        const originalSlideHTML = slide.outerHTML;
        carouselTrack.innerHTML = originalSlideHTML;
        const newSlide = carouselTrack.querySelector('.carousel-slide');
        carouselTrack.style.animation = 'none';

        const slideWidth = newSlide.offsetWidth;
        const clonesNeeded = Math.ceil(window.innerWidth / slideWidth) + 1;
        for (let i = 0; i < clonesNeeded; i++) {
            carouselTrack.insertAdjacentHTML('beforeend', originalSlideHTML);
        }

        const oldStyleSheet = document.getElementById('carousel-animation-style');
        if (oldStyleSheet) oldStyleSheet.remove();
        const styleSheet = document.createElement('style');
        styleSheet.id = 'carousel-animation-style';
        styleSheet.textContent = `@keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-${slideWidth}px); } }`;
        document.head.appendChild(styleSheet);

        const scrollSpeed = 60; // px per second
        carouselTrack.style.animation = `scroll ${slideWidth / scrollSpeed}s linear infinite`;

        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleMotionChange = () => {
            carouselTrack.style.animationPlayState = motionQuery.matches ? 'paused' : 'running';
        };
        handleMotionChange();
        if (!window.motionListenerAdded) {
            motionQuery.addEventListener('change', handleMotionChange);
            window.motionListenerAdded = true;
        }
    };

    initSeamlessCarousel();
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(initSeamlessCarousel, 250);
    });

    // --- Sticky header, mobile menu, active section ---
    const siteHeader = document.getElementById('site-header');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    if (siteHeader) {
        window.addEventListener('scroll', () => {
            siteHeader.classList.toggle('scrolled', window.scrollY > 50);
        }, { passive: true });
    }

    if (mobileMenuBtn && mobileMenu) {
        const setOpen = (isOpen) => {
            mobileMenu.classList.toggle('open', isOpen);
            mobileMenu.classList.toggle('hidden', !isOpen);
            mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
            const menuIcon = mobileMenuBtn.querySelector('.menu-icon');
            const closeIcon = mobileMenuBtn.querySelector('.close-icon');
            if (menuIcon && closeIcon) {
                menuIcon.classList.toggle('hidden', isOpen);
                closeIcon.classList.toggle('hidden', !isOpen);
            }
        };
        mobileMenuBtn.addEventListener('click', () => setOpen(!mobileMenu.classList.contains('open')));
        mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
    }

    if (sections.length > 0 && navLinks.length > 0) {
        const navObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            });
        }, { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' });
        sections.forEach(section => navObserver.observe(section));
    }
});
