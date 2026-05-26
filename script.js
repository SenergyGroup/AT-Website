const nav = document.getElementById('nav');
const navToggle = document.getElementById('nav-toggle');
const mobileNav = document.getElementById('mobile-nav');
const mobileClose = document.getElementById('mobile-close');
const navLinks = document.querySelectorAll('.nav__desktop a');
const mobileLinks = document.querySelectorAll('.mobile-nav a');
const revealEls = document.querySelectorAll('.reveal');
const countEls = document.querySelectorAll('[data-target]');
const sections = document.querySelectorAll('main section[id], header[id]');

function setNavState() {
  if (!nav) {
    return;
  }

  if (window.scrollY > 32) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}

function openMobileNav() {
  if (!mobileNav || !navToggle) {
    return;
  }

  mobileNav.classList.add('open');
  document.body.classList.add('menu-open');
  navToggle.setAttribute('aria-expanded', 'true');
  mobileNav.setAttribute('aria-hidden', 'false');
}

function closeMobileNav() {
  if (!mobileNav || !navToggle) {
    return;
  }

  mobileNav.classList.remove('open');
  document.body.classList.remove('menu-open');
  navToggle.setAttribute('aria-expanded', 'false');
  mobileNav.setAttribute('aria-hidden', 'true');
}

if (navToggle) {
  navToggle.addEventListener('click', () => {
    if (mobileNav.classList.contains('open')) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });
}

if (mobileClose) {
  mobileClose.addEventListener('click', closeMobileNav);
}

mobileLinks.forEach((link) => {
  link.addEventListener('click', closeMobileNav);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && mobileNav && mobileNav.classList.contains('open')) {
    closeMobileNav();
  }
});

window.addEventListener('scroll', setNavState, { passive: true });
setNavState();

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.14,
    rootMargin: '0px 0px -40px 0px'
  }
);

revealEls.forEach((el) => revealObserver.observe(el));

function animateCount(el) {
  const target = Number(el.dataset.target || 0);
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';
  const duration = 1600;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);
    el.textContent = `${prefix}${value}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

const countObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.5
  }
);

countEls.forEach((el) => countObserver.observe(el));

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const id = entry.target.getAttribute('id');
      navLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
      });
    });
  },
  {
    threshold: 0.45
  }
);

sections.forEach((section) => sectionObserver.observe(section));

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
    const href = anchor.getAttribute('href');
    const target = href ? document.querySelector(href) : null;

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
