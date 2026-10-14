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
    const isAlreadyExpanded = albumsGrid.classList.contains('expanded');
    if (!isAlreadyExpanded) {
      albumsGrid.classList.add('expanded');
    }

    const firstCard = albumsGrid.querySelector('.album-card');
    const scrollDistance = firstCard ? (firstCard.offsetWidth + 22) * 2 : 400;
    const maxScroll = albumsGrid.scrollWidth - albumsGrid.clientWidth;

    if (isAlreadyExpanded && albumsGrid.scrollLeft >= maxScroll - 20) {
      albumsGrid.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      albumsGrid.scrollBy({ left: scrollDistance, behavior: 'smooth' });
    }
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
    const isAlreadyExpanded = artistsGrid.classList.contains('expanded');
    if (!isAlreadyExpanded) {
      artistsGrid.classList.add('expanded');
    }

    const firstCard = artistsGrid.querySelector('.artist-card');
    const scrollDistance = firstCard ? (firstCard.offsetWidth + 32) * 2 : 360;
    const maxScroll = artistsGrid.scrollWidth - artistsGrid.clientWidth;

    if (isAlreadyExpanded && artistsGrid.scrollLeft >= maxScroll - 20) {
      artistsGrid.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      artistsGrid.scrollBy({ left: scrollDistance, behavior: 'smooth' });
    }
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
 * Controls HTML5 Audio for individual song play buttons and fixed bottom mini player
 */
function initSongPlayback() {
  const songItems = document.querySelectorAll('.song-list-item');
  const miniPlayer = document.getElementById('miniPlayer');
  if (!songItems.length && !miniPlayer) return;

  // Mini Player Elements
  const miniPlayerTrack = document.getElementById('miniPlayerTrack');
  const miniCover = document.getElementById('miniPlayerCover');
  const miniTitle = document.getElementById('miniPlayerTitle');
  const miniArtist = document.getElementById('miniPlayerArtist');
  const miniPlayBtn = document.getElementById('miniPlayBtn');
  const miniPrevBtn = document.getElementById('miniPrevBtn');
  const miniNextBtn = document.getElementById('miniNextBtn');
  const miniSeekSlider = document.getElementById('miniSeekSlider');
  const miniCurrentTime = document.getElementById('miniCurrentTime');
  const miniTotalTime = document.getElementById('miniTotalTime');
  const miniVolumeBtn = document.getElementById('miniVolumeBtn');
  const miniVolumeSlider = document.getElementById('miniVolumeSlider');

  // Full-Screen Player Elements
  const fullscreenPlayer = document.getElementById('fullscreenPlayer');
  const fsAmbientGlow = document.getElementById('fsAmbientGlow');
  const fsCloseBtn = document.getElementById('fsCloseBtn');
  const fsArtwork = document.getElementById('fsArtwork');
  const fsSongTitle = document.getElementById('fsSongTitle');
  const fsArtistName = document.getElementById('fsArtistName');
  const fsSeekSlider = document.getElementById('fsSeekSlider');
  const fsCurrentTime = document.getElementById('fsCurrentTime');
  const fsTotalTime = document.getElementById('fsTotalTime');
  const fsShuffleBtn = document.getElementById('fsShuffleBtn');
  const fsPrevBtn = document.getElementById('fsPrevBtn');
  const fsPlayBtn = document.getElementById('fsPlayBtn');
  const fsNextBtn = document.getElementById('fsNextBtn');
  const fsRepeatBtn = document.getElementById('fsRepeatBtn');
  const fsVolumeBtn = document.getElementById('fsVolumeBtn');
  const fsVolumeSlider = document.getElementById('fsVolumeSlider');

  // Shared Audio & Playback State
  let currentAudio = null;
  let currentButton = null;
  let isSeeking = false;
  let seekEndTimeout = null;
  let currentVolume = 1;
  let isMuted = false;
  let prevVolumeBeforeMute = 1;
  let isShuffle = false;
  let repeatMode = 'off'; // 'off' | 'all' | 'one'

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Sync Play/Pause UI across Mini Player and Full-Screen Player
  function syncPlayerPlayButtons(isPlaying) {
    // Mini Player Play/Pause
    if (miniPlayBtn) {
      const playIcon = miniPlayBtn.querySelector('.mini-icon-play, .icon-play');
      const pauseIcon = miniPlayBtn.querySelector('.mini-icon-pause, .icon-pause');
      if (isPlaying) {
        miniPlayBtn.setAttribute('aria-label', 'Pause');
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
      } else {
        miniPlayBtn.setAttribute('aria-label', 'Play');
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
      }
    }

    // Full-Screen Player Play/Pause
    if (fsPlayBtn) {
      const fsPlayIcon = fsPlayBtn.querySelector('.fs-icon-play, .icon-play');
      const fsPauseIcon = fsPlayBtn.querySelector('.fs-icon-pause, .icon-pause');
      if (isPlaying) {
        fsPlayBtn.setAttribute('aria-label', 'Pause');
        if (fsPlayIcon) fsPlayIcon.style.display = 'none';
        if (fsPauseIcon) fsPauseIcon.style.display = 'block';
      } else {
        fsPlayBtn.setAttribute('aria-label', 'Play');
        if (fsPlayIcon) fsPlayIcon.style.display = 'block';
        if (fsPauseIcon) fsPauseIcon.style.display = 'none';
      }
    }
  }

  function showMiniPlayer() {
    if (!miniPlayer) return;
    if (miniPlayer.style.display === 'none') {
      miniPlayer.style.display = 'block';
    }
    requestAnimationFrame(() => {
      miniPlayer.classList.add('visible');
    });
    document.body.classList.add('has-mini-player');
  }

  function openFullscreenPlayer() {
    if (!fullscreenPlayer) return;
    fullscreenPlayer.style.display = 'flex';
    document.body.classList.add('fs-player-open');
    requestAnimationFrame(() => {
      fullscreenPlayer.classList.add('visible');
    });
    if (currentButton) {
      updateTrackDisplays(currentButton);
    }
    const isCurrentlyPlaying = !!(currentAudio && !currentAudio.paused && !currentAudio.ended);
    syncPlayerPlayButtons(isCurrentlyPlaying);
    updateProgress();
  }

  function closeFullscreenPlayer() {
    if (!fullscreenPlayer) return;
    fullscreenPlayer.classList.remove('visible');
    document.body.classList.remove('fs-player-open');
    setTimeout(() => {
      if (!fullscreenPlayer.classList.contains('visible')) {
        fullscreenPlayer.style.display = 'none';
      }
    }, 380);
  }

  // Update Track Info across Mini Player and Full-Screen Player
  function updateTrackDisplays(button) {
    if (!button) return;
    const item = button.closest('.song-list-item');
    const title = button.getAttribute('data-title') || item?.querySelector('.song-title')?.textContent.trim() || 'Song';
    const artist = button.getAttribute('data-artist') || item?.querySelector('.song-artist-sub')?.textContent.trim() || 'Artist';
    const cover = button.getAttribute('data-cover') || document.querySelector('.album-hero-cover-img')?.getAttribute('src') || '';

    // Mini Player Info
    if (miniTitle) miniTitle.textContent = title;
    if (miniArtist) miniArtist.textContent = artist;
    if (miniCover && cover) {
      miniCover.src = cover;
      miniCover.alt = `${title} Cover Art`;
    }

    // Full-Screen Player Info
    if (fsSongTitle) fsSongTitle.textContent = title;
    if (fsArtistName) fsArtistName.textContent = artist;
    if (fsArtwork && cover) {
      fsArtwork.src = cover;
      fsArtwork.alt = `${title} Cover Art`;
    }
    if (fsAmbientGlow && cover) {
      fsAmbientGlow.style.backgroundImage = `url('${cover}')`;
    }
  }

  // Sync Song List Item State & Global Player Play/Pause
  function setPlayingState(button, isPlaying) {
    if (!button) {
      syncPlayerPlayButtons(isPlaying);
      return;
    }
    const item = button.closest('.song-list-item');
    const songTitle = button.getAttribute('data-title') || item?.querySelector('.song-title')?.textContent.trim() || 'Song';

    if (isPlaying) {
      button.classList.add('playing');
      item?.classList.add('playing');
      button.setAttribute('aria-label', `Pause ${songTitle}`);
      const playIcon = button.querySelector('.icon-play');
      const pauseIcon = button.querySelector('.icon-pause');
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
      syncPlayerPlayButtons(true);
    } else {
      button.classList.remove('playing');
      item?.classList.remove('playing');
      button.setAttribute('aria-label', `Play ${songTitle}`);
      const playIcon = button.querySelector('.icon-play');
      const pauseIcon = button.querySelector('.icon-pause');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
      syncPlayerPlayButtons(false);
    }
  }

  // Progress Bar & Duration Synchronization
  function updateProgress() {
    if (!currentAudio || isSeeking) return;

    const duration = currentAudio.duration;
    if (!duration || isNaN(duration) || !isFinite(duration) || duration <= 0) {
      return;
    }

    if (currentAudio.seeking) {
      return;
    }

    const currentTime = currentAudio.currentTime;
    if (isNaN(currentTime) || !isFinite(currentTime)) {
      return;
    }

    const pct = Math.min(100, Math.max(0, (currentTime / duration) * 100));
    const curTimeFormatted = formatTime(currentTime);
    const durTimeFormatted = formatTime(duration);

    if (miniSeekSlider) {
      miniSeekSlider.value = pct;
      miniSeekSlider.style.setProperty('--seek-pct', `${pct}%`);
    }
    if (fsSeekSlider) {
      fsSeekSlider.value = pct;
      fsSeekSlider.style.setProperty('--seek-pct', `${pct}%`);
    }

    if (miniCurrentTime) miniCurrentTime.textContent = curTimeFormatted;
    if (miniTotalTime) miniTotalTime.textContent = durTimeFormatted;
    if (fsCurrentTime) fsCurrentTime.textContent = curTimeFormatted;
    if (fsTotalTime) fsTotalTime.textContent = durTimeFormatted;
  }

  function getPlayableButtons() {
    return Array.from(document.querySelectorAll('.song-play-btn[data-audio]:not([disabled])'));
  }

  // Next Track Logic (Handles Shuffle, Sequential, and Repeat modes)
  function playNextSong(isAutoAdvance = false) {
    const playableButtons = getPlayableButtons();
    if (!playableButtons.length) return;
    const currentIndex = playableButtons.indexOf(currentButton);

    if (currentIndex === -1) {
      playableButtons[0].click();
      return;
    }

    // Auto-advance with repeat single track
    if (isAutoAdvance && repeatMode === 'one') {
      if (currentAudio) {
        currentAudio.currentTime = 0;
        currentAudio.play().then(() => {
          if (currentButton) setPlayingState(currentButton, true);
        }).catch(err => {
          console.warn('Playback error:', err);
        });
      }
      return;
    }

    // Shuffle Mode
    if (isShuffle && playableButtons.length > 1) {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * playableButtons.length);
      } while (nextIndex === currentIndex);
      playableButtons[nextIndex].click();
      return;
    }

    // Sequential Next
    if (currentIndex < playableButtons.length - 1) {
      playableButtons[currentIndex + 1].click();
    } else {
      // Last track reached
      if (isAutoAdvance) {
        if (repeatMode === 'all') {
          playableButtons[0].click();
        } else {
          // End of album reached without repeat
          if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
          }
          if (currentButton) setPlayingState(currentButton, false);
          syncPlayerPlayButtons(false);
          updateProgress();
        }
      } else {
        // User clicked Next on last song -> loop to start
        playableButtons[0].click();
      }
    }
  }

  // Previous Track Logic
  function playPrevSong() {
    const playableButtons = getPlayableButtons();
    if (!playableButtons.length) return;
    const currentIndex = playableButtons.indexOf(currentButton);

    if (currentIndex === -1) {
      playableButtons[0].click();
      return;
    }

    // If more than 3 seconds in, restart track
    if (currentAudio && currentAudio.currentTime > 3) {
      currentAudio.currentTime = 0;
      updateProgress();
      return;
    }

    const prevIndex = (currentIndex - 1 + playableButtons.length) % playableButtons.length;
    playableButtons[prevIndex].click();
  }

  // Toggle Play/Pause on current track
  function togglePlayPause() {
    if (!currentAudio) {
      const firstBtn = document.querySelector('.song-play-btn[data-audio]:not([disabled])');
      firstBtn?.click();
      return;
    }

    if (currentAudio.paused) {
      currentAudio.play().then(() => {
        if (currentButton) setPlayingState(currentButton, true);
        else syncPlayerPlayButtons(true);
      }).catch(err => {
        console.warn('Playback error:', err);
        if (currentButton) setPlayingState(currentButton, false);
        else syncPlayerPlayButtons(false);
      });
    } else {
      currentAudio.pause();
      if (currentButton) setPlayingState(currentButton, false);
      else syncPlayerPlayButtons(false);
    }
  }

  // Shuffle Toggle
  function toggleShuffle() {
    isShuffle = !isShuffle;
    if (fsShuffleBtn) {
      if (isShuffle) {
        fsShuffleBtn.classList.add('active');
        fsShuffleBtn.setAttribute('aria-label', 'Shuffle: On');
        fsShuffleBtn.setAttribute('title', 'Shuffle: On');
      } else {
        fsShuffleBtn.classList.remove('active');
        fsShuffleBtn.setAttribute('aria-label', 'Shuffle: Off');
        fsShuffleBtn.setAttribute('title', 'Shuffle: Off');
      }
    }
  }

  // Repeat Cycle: off -> all -> one -> off
  function cycleRepeat() {
    if (repeatMode === 'off') {
      repeatMode = 'all';
    } else if (repeatMode === 'all') {
      repeatMode = 'one';
    } else {
      repeatMode = 'off';
    }

    if (fsRepeatBtn) {
      fsRepeatBtn.classList.remove('active', 'repeat-one');
      if (repeatMode === 'all') {
        fsRepeatBtn.classList.add('active');
        fsRepeatBtn.setAttribute('aria-label', 'Repeat: All');
        fsRepeatBtn.setAttribute('title', 'Repeat: All');
      } else if (repeatMode === 'one') {
        fsRepeatBtn.classList.add('active', 'repeat-one');
        fsRepeatBtn.setAttribute('aria-label', 'Repeat: Current Track');
        fsRepeatBtn.setAttribute('title', 'Repeat: Current Track');
      } else {
        fsRepeatBtn.setAttribute('aria-label', 'Repeat: Off');
        fsRepeatBtn.setAttribute('title', 'Repeat: Off');
      }
    }
  }

  // Unified Seek Logic with Debounced Settle Timeout
  function applySeek(targetPct) {
    if (!currentAudio) {
      isSeeking = false;
      return;
    }

    const duration = currentAudio.duration;
    if (!duration || isNaN(duration) || !isFinite(duration) || duration <= 0) {
      isSeeking = false;
      return;
    }

    const pct = parseFloat(targetPct);
    const targetTime = (pct / 100) * duration;

    if (isFinite(targetTime) && targetTime >= 0) {
      currentAudio.currentTime = Math.min(targetTime, duration - 0.1);
      const formatted = formatTime(targetTime);
      if (miniCurrentTime) miniCurrentTime.textContent = formatted;
      if (fsCurrentTime) fsCurrentTime.textContent = formatted;

      if (miniSeekSlider) {
        miniSeekSlider.value = pct;
        miniSeekSlider.style.setProperty('--seek-pct', `${pct}%`);
      }
      if (fsSeekSlider) {
        fsSeekSlider.value = pct;
        fsSeekSlider.style.setProperty('--seek-pct', `${pct}%`);
      }
    }

    if (seekEndTimeout) clearTimeout(seekEndTimeout);
    seekEndTimeout = setTimeout(() => {
      isSeeking = false;
    }, 150);
  }

  function handleSeekInput(slider) {
    isSeeking = true;
    if (seekEndTimeout) clearTimeout(seekEndTimeout);

    const pct = parseFloat(slider.value);
    if (miniSeekSlider) {
      miniSeekSlider.value = pct;
      miniSeekSlider.style.setProperty('--seek-pct', `${pct}%`);
    }
    if (fsSeekSlider) {
      fsSeekSlider.value = pct;
      fsSeekSlider.style.setProperty('--seek-pct', `${pct}%`);
    }

    if (currentAudio && currentAudio.duration && !isNaN(currentAudio.duration)) {
      const previewTime = (pct / 100) * currentAudio.duration;
      const formatted = formatTime(previewTime);
      if (miniCurrentTime) miniCurrentTime.textContent = formatted;
      if (fsCurrentTime) fsCurrentTime.textContent = formatted;
    }
  }

  // Unified Volume Control & Mutual Synchronization
  function setVolume(val, updateSliders = true) {
    currentVolume = Math.max(0, Math.min(1, val));
    if (currentAudio) {
      currentAudio.volume = currentVolume;
    }
    isMuted = currentVolume === 0;

    const volPct = `${currentVolume * 100}%`;

    if (updateSliders) {
      if (miniVolumeSlider) miniVolumeSlider.value = currentVolume;
      if (fsVolumeSlider) fsVolumeSlider.value = currentVolume;
    }

    if (miniVolumeSlider) miniVolumeSlider.style.setProperty('--vol-pct', volPct);
    if (fsVolumeSlider) fsVolumeSlider.style.setProperty('--vol-pct', volPct);

    // Sync Mini Player Volume Icon
    if (miniVolumeBtn) {
      const volHighIcon = miniVolumeBtn.querySelector('.mini-vol-high');
      const volMutedIcon = miniVolumeBtn.querySelector('.mini-vol-muted');
      if (isMuted) {
        if (volHighIcon) volHighIcon.style.display = 'none';
        if (volMutedIcon) volMutedIcon.style.display = 'block';
        miniVolumeBtn.setAttribute('aria-label', 'Unmute');
      } else {
        if (volHighIcon) volHighIcon.style.display = 'block';
        if (volMutedIcon) volMutedIcon.style.display = 'none';
        miniVolumeBtn.setAttribute('aria-label', 'Mute');
      }
    }

    // Sync Full-Screen Volume Icon
    if (fsVolumeBtn) {
      const fsVolHighIcon = fsVolumeBtn.querySelector('.fs-vol-high');
      const fsVolMutedIcon = fsVolumeBtn.querySelector('.fs-vol-muted');
      if (isMuted) {
        if (fsVolHighIcon) fsVolHighIcon.style.display = 'none';
        if (fsVolMutedIcon) fsVolMutedIcon.style.display = 'block';
        fsVolumeBtn.setAttribute('aria-label', 'Unmute');
      } else {
        if (fsVolHighIcon) fsVolHighIcon.style.display = 'block';
        if (fsVolMutedIcon) fsVolMutedIcon.style.display = 'none';
        fsVolumeBtn.setAttribute('aria-label', 'Mute');
      }
    }
  }

  function toggleMute() {
    if (isMuted || currentVolume === 0) {
      const restoreVal = prevVolumeBeforeMute > 0 ? prevVolumeBeforeMute : 0.8;
      setVolume(restoreVal, true);
    } else {
      prevVolumeBeforeMute = currentVolume;
      setVolume(0, true);
    }
  }

  // Bind track rows & row play buttons
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

      // Stop any previously playing song and cleanly detach it
      if (currentAudio) {
        const oldAudio = currentAudio;
        currentAudio = null;
        oldAudio.pause();
        oldAudio.src = '';
      }
      if (currentButton) {
        setPlayingState(currentButton, false);
      }

      // Start new song using single Audio instance
      const audio = new Audio(audioUrl);
      audio.volume = isMuted ? 0 : currentVolume;
      currentAudio = audio;
      currentButton = btn;

      updateTrackDisplays(btn);
      showMiniPlayer();

      audio.play().then(() => {
        if (currentAudio === audio) {
          setPlayingState(btn, true);
        }
      }).catch(err => {
        console.warn('Playback error:', err);
        if (currentAudio === audio) {
          setPlayingState(btn, false);
        }
      });

      audio.addEventListener('timeupdate', () => {
        if (currentAudio !== audio) return;
        updateProgress();
      });

      audio.addEventListener('loadedmetadata', () => {
        if (currentAudio !== audio) return;
        if (audio.duration) {
          const formatted = formatTime(audio.duration);
          if (miniTotalTime) miniTotalTime.textContent = formatted;
          if (fsTotalTime) fsTotalTime.textContent = formatted;
        }
        updateProgress();
      });

      audio.addEventListener('durationchange', () => {
        if (currentAudio !== audio) return;
        if (audio.duration) {
          const formatted = formatTime(audio.duration);
          if (miniTotalTime) miniTotalTime.textContent = formatted;
          if (fsTotalTime) fsTotalTime.textContent = formatted;
        }
        updateProgress();
      });

      audio.addEventListener('seeking', () => {
        if (currentAudio !== audio) return;
        isSeeking = true;
      });

      audio.addEventListener('seeked', () => {
        if (currentAudio !== audio) return;
        isSeeking = false;
        updateProgress();
      });

      audio.addEventListener('ended', () => {
        if (currentAudio !== audio) return;
        playNextSong(true);
      });

      audio.addEventListener('pause', () => {
        if (currentAudio !== audio) return;
        if (audio.paused && !audio.seeking && !isSeeking) {
          setPlayingState(btn, false);
        }
      });

      audio.addEventListener('play', () => {
        if (currentAudio !== audio) return;
        setPlayingState(btn, true);
      });

      audio.addEventListener('playing', () => {
        if (currentAudio !== audio) return;
        setPlayingState(btn, true);
      });
    });

    // Clicking the song row also triggers the play button
    item.addEventListener('click', (e) => {
      if (e.target.closest('.song-play-btn')) return;
      btn.click();
    });
  });

  // Mini Player Open Full-Screen Triggers
  miniPlayer?.addEventListener('click', (e) => {
    // Prevent opening if user clicked interactive mini controls
    if (e.target.closest('.mini-ctrl-btn') ||
        e.target.closest('.mini-seek-slider-container') ||
        e.target.closest('.mini-volume-wrap') ||
        e.target.closest('input[type="range"]') ||
        e.target.closest('button')) {
      return;
    }
    openFullscreenPlayer();
  });

  miniPlayerTrack?.addEventListener('click', (e) => {
    e.stopPropagation();
    openFullscreenPlayer();
  });

  // Mini Player Controls: Play / Pause
  miniPlayBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
  });
  miniPlayBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
  miniPlayBtn?.addEventListener('mousedown', (e) => e.stopPropagation());

  // Mini Player Controls: Next & Prev
  miniNextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    playNextSong(false);
  });
  miniNextBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
  miniNextBtn?.addEventListener('mousedown', (e) => e.stopPropagation());

  miniPrevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    playPrevSong();
  });
  miniPrevBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
  miniPrevBtn?.addEventListener('mousedown', (e) => e.stopPropagation());

  // Mini Seek Slider Listeners
  if (miniSeekSlider) {
    miniSeekSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      handleSeekInput(miniSeekSlider);
    });

    miniSeekSlider.addEventListener('change', (e) => {
      e.stopPropagation();
      applySeek(miniSeekSlider.value);
    });

    miniSeekSlider.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });

    miniSeekSlider.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    miniSeekSlider.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (isSeeking) {
        applySeek(miniSeekSlider.value);
      }
    });

    miniSeekSlider.parentElement?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    miniSeekSlider.parentElement?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    miniSeekSlider.parentElement?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }

  // Mini Player Volume Listeners
  if (miniVolumeSlider) {
    miniVolumeSlider.style.setProperty('--vol-pct', '100%');
    miniVolumeSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseFloat(e.target.value);
      if (val > 0) prevVolumeBeforeMute = val;
      setVolume(val, false);
    });

    miniVolumeSlider.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    miniVolumeSlider.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }

  miniVolumeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMute();
  });
  miniVolumeBtn?.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
  miniVolumeBtn?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // ====================================================================
  // FULL-SCREEN PLAYER CONTROLS & LISTENERS
  // ====================================================================

  // Close Button & Escape Key
  fsCloseBtn?.addEventListener('click', closeFullscreenPlayer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fullscreenPlayer && fullscreenPlayer.classList.contains('visible')) {
      closeFullscreenPlayer();
    }
  });

  // Full-Screen Play/Pause
  fsPlayBtn?.addEventListener('click', togglePlayPause);

  // Full-Screen Next & Prev
  fsNextBtn?.addEventListener('click', () => {
    playNextSong(false);
  });

  fsPrevBtn?.addEventListener('click', () => {
    playPrevSong();
  });

  // Full-Screen Shuffle & Repeat
  fsShuffleBtn?.addEventListener('click', toggleShuffle);
  fsRepeatBtn?.addEventListener('click', cycleRepeat);

  // Full-Screen Seek Slider Listeners
  if (fsSeekSlider) {
    fsSeekSlider.addEventListener('input', () => {
      handleSeekInput(fsSeekSlider);
    });

    fsSeekSlider.addEventListener('change', () => {
      applySeek(fsSeekSlider.value);
    });

    fsSeekSlider.addEventListener('pointerup', () => {
      if (isSeeking) {
        applySeek(fsSeekSlider.value);
      }
    });
  }

  // Full-Screen Volume Listeners
  if (fsVolumeSlider) {
    fsVolumeSlider.style.setProperty('--vol-pct', '100%');
    fsVolumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val > 0) prevVolumeBeforeMute = val;
      setVolume(val, false);
    });
  }

  fsVolumeBtn?.addEventListener('click', toggleMute);

  // "Play Album" button in hero plays first song or toggles playback
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




