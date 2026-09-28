/**
 * Haven Music Streaming Web Application
 * Frontend JavaScript - Modular Vanilla JS
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initAuthModal();
  initLockedItems();
  initMobileMenu();
});

/**
 * Navbar scroll behavior & keyboard shortcuts
 */
function initNavbar() {
  const header = document.querySelector('.site-header');
  const searchInput = document.querySelector('.search-input');

  // Sticky header background on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }, { passive: true });

  // Quick keyboard shortcut: Press '/' to focus search bar
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        searchInput?.focus();
      }
    }
  });
}

/**
 * Interactive Login / Auth Prompt Modal
 */
function initAuthModal() {
  const modalOverlay = document.getElementById('authModalOverlay');
  const closeBtn = document.getElementById('authModalClose');
  const modalTitle = document.getElementById('authModalTitle');
  const modalSubtitle = document.getElementById('authModalSubtitle');

  if (!modalOverlay) return;

  // Open modal
  window.openAuthPrompt = function(title = 'Login to Listen', subtitle = 'Create a free Haven account or sign in to stream unlimited music.') {
    if (modalTitle) modalTitle.textContent = title;
    if (modalSubtitle) modalSubtitle.textContent = subtitle;
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  // Close modal
  window.closeAuthPrompt = function() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeAuthPrompt);

  // Close on backdrop click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeAuthPrompt();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeAuthPrompt();
    }
  });
}

/**
 * Handle locked music items (Albums, Songs)
 */
function initLockedItems() {
  const lockedItems = document.querySelectorAll('[data-locked="true"]');

  lockedItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const title = item.getAttribute('data-title') || 'This Album';
      window.openAuthPrompt(
        `Listen to "${title}"`,
        'Sign in to Haven to stream full albums, create personalized playlists, and follow your favorite artists.'
      );
    });
  });

  // "Explore Music" button can also prompt login or scroll to albums
  const exploreBtn = document.getElementById('exploreMusicBtn');
  exploreBtn?.addEventListener('click', (e) => {
    const albumsSection = document.getElementById('popular-albums');
    if (albumsSection) {
      albumsSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

/**
 * Mobile Navigation Drawer Toggle
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileNavToggle');
  const drawer = document.getElementById('mobileMenuDrawer');

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Close mobile drawer when clicking a link
  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      drawer.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });
}
