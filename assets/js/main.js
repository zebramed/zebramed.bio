// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', function() {

    // Intersection Observer for reveal-on-scroll animations
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const el = entry.target;
            const isSolution = el.id === 'solution-animation-container';

            if (entry.isIntersecting) {
                // For all reveal elements
                el.classList.add('visible');
                el.classList.add('is-visible');

                // Reset and start constellation animation each time it enters view
                if (isSolution) {
                    const lines = el.querySelectorAll('.constellation-line');
                    lines.forEach((line) => {
                        const length = line.getTotalLength();
                        line.style.strokeDasharray = length;
                        line.style.strokeDashoffset = length;
                        line.style.setProperty('--line-length', length);
                    });
                    // Force reflow on svg to restart CSS animations when class toggles
                    const svg = el.querySelector('svg');
                    if (svg) { void svg.offsetWidth; }
                }
            } else {
                // Allow re-entrance animations by removing visibility classes
                el.classList.remove('visible');
                el.classList.remove('is-visible');

                if (isSolution) {
                    // Ensure lines are reset so next entry animates from start
                    const lines = el.querySelectorAll('.constellation-line');
                    lines.forEach((line) => {
                        const length = line.getTotalLength();
                        line.style.strokeDasharray = length;
                        line.style.strokeDashoffset = length;
                        line.style.setProperty('--line-length', length);
                    });
                }
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-on-scroll').forEach((el) => { 
        scrollObserver.observe(el); 
    });

    // LOI Counter Animation
    const loiCounter = document.getElementById('loi-counter');
    if (loiCounter) {
        const counterObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const target = 5; // Set your target number of LOIs here
                    let current = 0;
                    const increment = target / 100;

                    const updateCounter = () => {
                        if (current < target) {
                            current += increment;
                            el.textContent = Math.ceil(current);
                            requestAnimationFrame(updateCounter);
                        } else {
                            el.textContent = target;
                        }
                    };
                    updateCounter();
                    observer.unobserve(el); // Animate only once
                }
            });
        }, { threshold: 0.8 });
        
        counterObserver.observe(loiCounter);
    }

    // --- UPDATED: SEAMLESS CAROUSEL LOGIC ---
    const initSeamlessCarousel = async () => { // Make the function async
        const carouselTrack = document.querySelector('.carousel-track');
        if (!carouselTrack) return;

        const slide = carouselTrack.querySelector('.carousel-slide');
        if (!slide) return;
        
        // --- NEW: Wait for all images inside the carousel to load ---
        const images = slide.querySelectorAll('img');
        const promises = [...images].map(img => {
            return new Promise((resolve) => {
                // If the image is already loaded (e.g., from cache), resolve immediately
                if (img.complete) {
                    resolve();
                } else {
                    // Otherwise, wait for the load or error event
                    img.addEventListener('load', resolve, { once: true });
                    img.addEventListener('error', resolve, { once: true }); // Resolve on error too, so it doesn't break the carousel
                }
            });
        });
        // Wait for all image-loading promises to complete
        await Promise.all(promises);
        // --- END NEW PART ---

        // Clear previous state for recalculation on resize
        // We get the original slide HTML to avoid issues with cloning clones
        const originalSlideHTML = slide.outerHTML;
        carouselTrack.innerHTML = originalSlideHTML;
        const newSlide = carouselTrack.querySelector('.carousel-slide');
        carouselTrack.style.animation = 'none';

        // Calculate the width of a single slide (now guaranteed to be accurate)
        const slideWidth = newSlide.offsetWidth;

        // Clone the slide enough times to fill the screen and create a buffer
        const clonesNeeded = Math.ceil(window.innerWidth / slideWidth) + 1;
        for (let i = 0; i < clonesNeeded; i++) {
            carouselTrack.insertAdjacentHTML('beforeend', originalSlideHTML);
        }

        // Create a dynamic keyframe animation
        const scrollAnimation = `
            @keyframes scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-${slideWidth}px); }
            }
        `;
        
        // Remove old stylesheet if it exists to prevent memory leaks
        const oldStyleSheet = document.getElementById('carousel-animation-style');
        if (oldStyleSheet) {
            oldStyleSheet.remove();
        }

        // Add the new keyframes to the document's head
        const styleSheet = document.createElement("style");
        styleSheet.id = 'carousel-animation-style'; // Give it an ID for easy removal
        styleSheet.type = "text/css";
        styleSheet.innerText = scrollAnimation;
        document.head.appendChild(styleSheet);
        
        // Calculate duration based on width to maintain constant speed
        const scrollSpeed = 80; // pixels per second
        const duration = slideWidth / scrollSpeed;

        // Apply the animation
        carouselTrack.style.animation = `scroll ${duration}s linear infinite`;

        // Check for reduced motion preference
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleMotionChange = () => {
            if (motionQuery.matches) {
                carouselTrack.style.animationPlayState = 'paused';
            } else {
                carouselTrack.style.animationPlayState = 'running';
            }
        };
        handleMotionChange();
        // Avoid adding multiple listeners by checking if one exists
        if (!window.motionListenerAdded) {
            motionQuery.addEventListener('change', handleMotionChange);
            window.motionListenerAdded = true;
        }
    };

    initSeamlessCarousel();

    // Recalculate on window resize to ensure responsiveness
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            initSeamlessCarousel();
        }, 250); // Debounce to avoid excessive recalculations
    });
    // --- END: SEAMLESS CAROUSEL LOGIC ---

    // --- STICKY HEADER & NAVIGATION ---
    const siteHeader = document.getElementById('site-header');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    // Sticky header on scroll
    if (siteHeader) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                siteHeader.classList.add('scrolled');
            } else {
                siteHeader.classList.remove('scrolled');
            }
        });
    }

    // Mobile menu toggle
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            const isOpen = mobileMenu.classList.toggle('open');
            mobileMenu.classList.toggle('hidden', !isOpen);
            
            // Toggle icon
            const menuIcon = mobileMenuBtn.querySelector('.menu-icon');
            const closeIcon = mobileMenuBtn.querySelector('.close-icon');
            if (menuIcon && closeIcon) {
                menuIcon.classList.toggle('hidden', isOpen);
                closeIcon.classList.toggle('hidden', !isOpen);
            }
        });

        // Close mobile menu when clicking a link
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('open');
                mobileMenu.classList.add('hidden');
                const menuIcon = mobileMenuBtn.querySelector('.menu-icon');
                const closeIcon = mobileMenuBtn.querySelector('.close-icon');
                if (menuIcon && closeIcon) {
                    menuIcon.classList.remove('hidden');
                    closeIcon.classList.add('hidden');
                }
            });
        });
    }

    // Active section highlighting
    if (sections.length > 0 && navLinks.length > 0) {
        const navObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, { 
            threshold: 0.3,
            rootMargin: '-80px 0px -50% 0px'
        });

        sections.forEach(section => {
            navObserver.observe(section);
        });
    }
    // --- END: STICKY HEADER & NAVIGATION ---
});