/**
 * Haven Music Streaming Web Application
 * Frontend JavaScript - Modular Vanilla JS
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initNavbarScrollSpy();
  initAuthModal();
  initLockedItems();
  initViewAllAlbums();
  initViewAllArtists();
  initSongPlayback();
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
 * Active navbar section tracking & smooth navigation (Home Page)
 * Uses IntersectionObserver & viewport probe detection to highlight the visible section
 */
function initNavbarScrollSpy() {
  const heroSection = document.getElementById('hero');
  const albumsSection = document.getElementById('popular-albums');
  // Only activate on the homepage where these sections exist
  if (!heroSection || !albumsSection) return;

  const navLinks = document.querySelectorAll('.nav-center .nav-link');
  if (!navLinks.length) return;

  const sectionNavMap = [
    { id: 'hero', navKey: 'hero' },
    { id: 'features', navKey: 'features' },
    { id: 'popular-albums', navKey: 'popular-albums' },
    { id: 'featured-artists', navKey: 'featured-artists' },
    { id: 'community', navKey: 'community' },
    { id: 'about', navKey: 'community' }
  ];

  let isManualClick = false;
  let clickTimeout = null;

  function setActiveNav(navKey) {
    navLinks.forEach(link => {
      const sectionTarget = link.getAttribute('data-section');
      if (sectionTarget === navKey) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  function getActiveSection() {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // 1. Near the very top of the page (Hero section)
    if (scrollY < 120) {
      return 'hero';
    }

    // 2. Near the bottom of the page (About / CTA / Footer)
    if (scrollY + windowHeight >= docHeight - 80) {
      return 'community';
    }

    // 3. Scan sections based on viewport probe line (160px from top)
    const probeY = 160;
    const sectionIds = ['community', 'about', 'featured-artists', 'popular-albums', 'features', 'hero'];

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= probeY && rect.bottom > probeY) {
        return id === 'about' ? 'community' : id;
      }
    }

    return 'hero';
  }

  function updateActiveSection() {
    if (isManualClick) return;
    const activeKey = getActiveSection();
    setActiveNav(activeKey);
  }

  // Handle smooth click navigation for navbar links on the homepage
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetKey = link.getAttribute('data-section');
      if (!targetKey) return;

      const targetId = targetKey === 'hero' ? 'hero' : targetKey;
      const targetEl = document.getElementById(targetId);

      if (targetEl) {
        e.preventDefault();
        isManualClick = true;
        if (clickTimeout) clearTimeout(clickTimeout);

        setActiveNav(targetKey);

        if (targetKey === 'hero') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          if (window.location.hash) {
            history.pushState(null, null, window.location.pathname);
          }
        } else {
          const navbarHeight = document.querySelector('.site-header')?.offsetHeight || 72;
          const elementPosition = targetEl.getBoundingClientRect().top + window.scrollY;
          const offsetPosition = elementPosition - navbarHeight;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
          history.pushState(null, null, '#' + targetId);
        }

        clickTimeout = setTimeout(() => {
          isManualClick = false;
        }, 850);
      }
    });
  });

  // IntersectionObserver for performant threshold change detection
  const observedElements = sectionNavMap
    .map(item => document.getElementById(item.id))
    .filter(Boolean);

  if ('IntersectionObserver' in window && observedElements.length > 0) {
    const observer = new IntersectionObserver(() => {
      if (!isManualClick) {
        updateActiveSection();
      }
    }, {
      rootMargin: '-15% 0px -40% 0px',
      threshold: [0, 0.2]
    });

    observedElements.forEach(el => observer.observe(el));
  }

  // Scroll listener with requestAnimationFrame for fluid continuous tracking
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateActiveSection();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // Initial active detection on page load (support initial hash or scroll position)
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    const matched = sectionNavMap.find(item => item.id === hash);
    if (matched) {
      setActiveNav(matched.navKey);
    } else {
      updateActiveSection();
    }
  } else {
    updateActiveSection();
  }
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

  // "Start Listening" / "Explore Music" button scrolls to albums
  const exploreBtn = document.getElementById('exploreMusicBtn');
  exploreBtn?.addEventListener('click', (e) => {
    const albumsSection = document.getElementById('popular-albums');
    if (albumsSection) {
      albumsSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

/**
 * Popular Albums "View All" expansion
 * Reveals remaining albums in a horizontal scrollable row and hides View All button
 */
function initViewAllAlbums() {
  const viewAllBtn = document.getElementById('viewAllAlbumsBtn');
  const albumsGrid = document.getElementById('albumsGrid');

  if (!viewAllBtn || !albumsGrid) return;

  viewAllBtn.addEventListener('click', (e) => {
    e.preventDefault();
    albumsGrid.classList.add('expanded');
    viewAllBtn.style.display = 'none';
  });

  enableHorizontalScroll(albumsGrid);
}

/**
 * Featured Artists "View All" expansion
 * Reveals remaining artists in a horizontal scrollable row and hides View All button
 */
function initViewAllArtists() {
  const viewAllBtn = document.getElementById('viewAllArtistsBtn');
  const artistsGrid = document.getElementById('artistsGrid');

  if (!viewAllBtn || !artistsGrid) return;

  viewAllBtn.addEventListener('click', (e) => {
    e.preventDefault();
    artistsGrid.classList.add('expanded');
    viewAllBtn.style.display = 'none';
  });

  enableHorizontalScroll(artistsGrid);
}

/**
 * Enables smooth mouse-wheel horizontal scrolling and drag-to-scroll for horizontally overflowing containers
 */
function enableHorizontalScroll(element) {
  if (!element) return;

  // Mouse wheel horizontal scrolling
  element.addEventListener('wheel', (e) => {
    if (element.classList.contains('expanded') && e.deltaY !== 0) {
      if (element.scrollWidth > element.clientWidth) {
        e.preventDefault();
        element.scrollLeft += e.deltaY;
      }
    }
  }, { passive: false });

  // Mouse drag-to-scroll
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let hasMoved = false;

  element.addEventListener('mousedown', (e) => {
    if (!element.classList.contains('expanded')) return;
    if (e.button !== 0) return; // Only main left click
    isDown = true;
    hasMoved = false;
    startX = e.pageX - element.offsetLeft;
    scrollLeft = element.scrollLeft;
  });

  window.addEventListener('mouseup', () => {
    isDown = false;
  });

  element.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.pageX - element.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) {
      hasMoved = true;
      e.preventDefault();
      element.scrollLeft = scrollLeft - walk;
    }
  });

  // Prevent accidental click when dragging
  element.addEventListener('click', (e) => {
    if (hasMoved) {
      e.stopPropagation();
      e.preventDefault();
      hasMoved = false;
    }
  }, true);
}

/**
 * Functional song playback for Album Detail page
 * Controls HTML5 Audio for individual song play buttons
 */
function initSongPlayback() {
  const songItems = document.querySelectorAll('.song-list-item');
  if (!songItems.length) return;

  let currentAudio = null;
  let currentButton = null;

  function setPlayingState(button, isPlaying) {
    const item = button.closest('.song-list-item');
    const songTitle = item?.querySelector('.song-title')?.textContent.trim() || 'Song';

    if (isPlaying) {
      button.classList.add('playing');
      item?.classList.add('playing');
      button.setAttribute('aria-label', `Pause ${songTitle}`);
      const playIcon = button.querySelector('.icon-play');
      const pauseIcon = button.querySelector('.icon-pause');
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
    } else {
      button.classList.remove('playing');
      item?.classList.remove('playing');
      button.setAttribute('aria-label', `Play ${songTitle}`);
      const playIcon = button.querySelector('.icon-play');
      const pauseIcon = button.querySelector('.icon-pause');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
    }
  }

  function stopCurrent() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (currentButton) {
      setPlayingState(currentButton, false);
    }
    currentAudio = null;
    currentButton = null;
  }

  songItems.forEach(item => {
    const btn = item.querySelector('.song-play-btn');
    if (!btn) return;

    const audioUrl = btn.getAttribute('data-audio');
    if (!audioUrl) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      // If clicking the currently playing song
      if (currentButton === btn && currentAudio) {
        if (currentAudio.paused) {
          currentAudio.play().then(() => {
            setPlayingState(btn, true);
          }).catch(err => {
            console.warn('Playback error:', err);
            setPlayingState(btn, false);
          });
        } else {
          currentAudio.pause();
          setPlayingState(btn, false);
        }
        return;
      }

      // Stop any previously playing song
      stopCurrent();

      // Start new song
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      currentButton = btn;

      audio.play().then(() => {
        setPlayingState(btn, true);
      }).catch(err => {
        console.warn('Playback error:', err);
        setPlayingState(btn, false);
        currentAudio = null;
        currentButton = null;
      });

      audio.addEventListener('ended', () => {
        setPlayingState(btn, false);
        currentAudio = null;
        currentButton = null;
      });

      audio.addEventListener('pause', () => {
        setPlayingState(btn, false);
      });

      audio.addEventListener('play', () => {
        setPlayingState(btn, true);
      });
    });

    // Clicking the song row also triggers the play button
    item.addEventListener('click', (e) => {
      if (e.target.closest('.song-play-btn')) return;
      btn.click();
    });
  });

  // "Play Album" button in hero plays first available song
  const playAlbumBtn = document.querySelector('.album-play-all-btn');
  playAlbumBtn?.addEventListener('click', () => {
    if (currentButton) {
      currentButton.click();
      return;
    }
    const firstBtn = document.querySelector('.song-play-btn[data-audio]:not([disabled])');
    firstBtn?.click();
  });
}



