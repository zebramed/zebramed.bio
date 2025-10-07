// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', function() {

    // Intersection Observer for reveal-on-scroll animations
    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                entry.target.classList.add('visible');

                // Check if the intersecting element is the constellation animation container
                if (entry.target.id === 'solution-animation-container') {
                    const lines = entry.target.querySelectorAll('.constellation-line');
                    // Check if setup has already been done to avoid re-running
                    if (lines.length > 0 && !lines[0].style.strokeDasharray) {
                         lines.forEach(line => {
                            const length = line.getTotalLength();
                            line.style.strokeDasharray = length;
                            line.style.strokeDashoffset = length;
                            line.style.setProperty('--line-length', length);
                        });
                    }
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

});