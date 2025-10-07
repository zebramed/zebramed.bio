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

    // (reverted) sticky/shrink header logic removed

});