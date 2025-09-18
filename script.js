// Sol Arena Marketing Site JavaScript

// Copy contract address function
function copyContract() {
    const contractAddress = document.getElementById('contractAddress').textContent;
    const copyIcon = document.getElementById('copyIcon');
    
    navigator.clipboard.writeText(contractAddress).then(function() {
        // Success feedback
        copyIcon.textContent = '✅';
        setTimeout(() => {
            copyIcon.textContent = '📋';
        }, 2000);
    }).catch(function(err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = contractAddress;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        copyIcon.textContent = '✅';
        setTimeout(() => {
            copyIcon.textContent = '📋';
        }, 2000);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Intersection Observer for animations
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

    // Animate elements on scroll
    const animateElements = document.querySelectorAll('.step-card, .rule-category, .mode-card, .requirement-card');
    
    animateElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        observer.observe(el);
    });

    // Dynamic stats counter animation
    const statNumbers = document.querySelectorAll('.stat-number');
    
    const animateCounter = (element, target) => {
        const duration = 2000;
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            // Format numbers with + for 2000+
            if (target >= 2000) {
                element.textContent = Math.floor(current).toLocaleString() + '+';
            } else {
                element.textContent = Math.floor(current).toLocaleString();
            }
        }, 16);
    };

    // Trigger counter animation when hero section is visible
    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                statNumbers.forEach(stat => {
                    const target = parseInt(stat.textContent.replace(/[^\d]/g, ''));
                    animateCounter(stat, target);
                });
                heroObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        heroObserver.observe(heroSection);
    }

    // Interactive mode cards
    const modeCards = document.querySelectorAll('.mode-card');
    
    modeCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            if (!this.classList.contains('locked')) {
                this.style.transform = 'translateY(-10px) scale(1.02)';
                this.style.boxShadow = '0 20px 60px rgba(120, 219, 226, 0.3)';
            }
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '';
        });
    });

    // Parallax effect for hero background
    let ticking = false;
    
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.hero-background');
        
        parallaxElements.forEach(element => {
            const speed = 0.5;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
        
        ticking = false;
    }
    
    function requestParallaxUpdate() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestParallaxUpdate);

    // Dynamic gradient animation for buttons
    const primaryButtons = document.querySelectorAll('.btn-primary');
    
    primaryButtons.forEach(button => {
        button.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const deltaX = (x - centerX) / centerX;
            const deltaY = (y - centerY) / centerY;
            
            this.style.transform = `translateY(-3px) rotateX(${deltaY * 5}deg) rotateY(${deltaX * 5}deg)`;
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) rotateX(0) rotateY(0)';
        });
    });

    // Typing animation for hero subtitle
    const subtitle = document.querySelector('.hero-subtitle');
    if (subtitle) {
        const text = subtitle.textContent;
        subtitle.textContent = '';
        
        let i = 0;
        const typeWriter = () => {
            if (i < text.length) {
                subtitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 100);
            }
        };
        
        // Start typing animation after a delay
        setTimeout(typeWriter, 1000);
    }

    // Add glitch effect to title on hover
    const titleElements = document.querySelectorAll('.title-sol, .title-arena');
    
    titleElements.forEach(title => {
        title.addEventListener('mouseenter', function() {
            this.style.animation = 'none';
            this.style.animation = 'glitch 0.3s ease-in-out';
        });
        
        title.addEventListener('animationend', function() {
            this.style.animation = 'neonPulse 3s ease-in-out infinite';
        });
    });

    // Add CSS for glitch animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes glitch {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-2px); }
            40% { transform: translateX(2px); }
            60% { transform: translateX(-1px); }
            80% { transform: translateX(1px); }
        }
    `;
    document.head.appendChild(style);

    // Floating particles effect
    function createParticle() {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.width = '2px';
        particle.style.height = '2px';
        particle.style.background = 'rgba(120, 219, 226, 0.6)';
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '1';
        
        const startX = Math.random() * window.innerWidth;
        const startY = window.innerHeight + 10;
        const endY = -10;
        const duration = Math.random() * 3000 + 2000;
        
        particle.style.left = startX + 'px';
        particle.style.top = startY + 'px';
        
        document.body.appendChild(particle);
        
        particle.animate([
            { transform: 'translateY(0px)', opacity: 0 },
            { transform: 'translateY(-20px)', opacity: 1, offset: 0.1 },
            { transform: `translateY(${endY - startY}px)`, opacity: 0 }
        ], {
            duration: duration,
            easing: 'linear'
        }).onfinish = () => {
            particle.remove();
        };
    }

    // Create particles periodically
    setInterval(createParticle, 300);

    // Add loading animation for external links
    const externalLinks = document.querySelectorAll('a[target="_blank"]');
    
    externalLinks.forEach(link => {
        link.addEventListener('click', function() {
            const originalText = this.innerHTML;
            this.innerHTML = '<span>🚀 Launching...</span>';
            
            setTimeout(() => {
                this.innerHTML = originalText;
            }, 2000);
        });
    });

    // Console easter egg
    console.log(`
    ╔═══════════════════════════════════════╗
    ║           🚀 SOL ARENA 🚀             ║
    ║                                       ║
    ║     Token-Gated Battle Royale         ║
    ║                                       ║
    ║  Built with ❤️ for the Solana        ║
    ║  community and pump.fun tokens        ║
    ║                                       ║
    ║  Ready to enter the arena? 🏟️         ║
    ╚═══════════════════════════════════════╝
    `);
});

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add scroll-based header effects if needed in future
window.addEventListener('scroll', debounce(() => {
    const scrolled = window.pageYOffset;
    const rate = scrolled * -0.5;
    
    // Future: Add header background changes based on scroll
}, 10));
