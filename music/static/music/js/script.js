/**
 * Haven Music Streaming Web Application
 * Frontend JavaScript - Modular Vanilla JS
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initNavbarScrollSpy();
  initAuthModal();
  initPasswordToggles();
  initSignupValidation();
  initLockedItems();
  initViewAllAlbums();
  initViewAllArtists();
  initSongPlayback();
  initSearchAutocomplete();
  initLikeButtons();
  initFollowButtons();
  initProfileDropdown();
  initProfileAvatarCustomization();
  initPlaylistSongControls();
  initHistorySongControls();
  initPlaylistDetailManagement();
  initPresetGallerySelection();
  initPersistentNavigation();
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
 * Profile Dropdown Menu Interaction and Accessibility
 * Handles avatar toggle, outside click, Escape key dismiss, focus management,
 * close-on-navigate, and audio pause on logout.
 */
function initProfileDropdown() {
  const wrapper = document.getElementById('profileDropdownWrapper');
  const triggerBtn = document.getElementById('profileAvatarBtn');
  const menu = document.getElementById('profileDropdownMenu');

  // If not logged in or elements not present, provide a safe no-op close function
  if (!wrapper || !triggerBtn || !menu) {
    window.closeProfileDropdown = () => {};
    return;
  }

  function openDropdown() {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    triggerBtn.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown(focusTrigger = false) {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    triggerBtn.setAttribute('aria-expanded', 'false');
    if (focusTrigger && document.activeElement !== triggerBtn) {
      triggerBtn.focus();
    }
  }

  function toggleDropdown() {
    if (menu.classList.contains('is-open')) {
      closeDropdown(false);
    } else {
      openDropdown();
    }
  }

  // Expose global close function
  window.closeProfileDropdown = closeDropdown;

  // Prevent multiple event listener registrations across PJAX transitions
  if (wrapper.dataset.profileInitialized === 'true') {
    return;
  }
  wrapper.dataset.profileInitialized = 'true';

  // Toggle on avatar button click
  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  // Close when clicking outside wrapper
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closeDropdown(false);
    }
  });

  // Close on Escape key and return focus to avatar trigger button
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (menu.classList.contains('is-open')) {
        e.preventDefault();
        closeDropdown(true);
      }
    }
  });

  // Close dropdown when any item inside is selected
  menu.querySelectorAll('.profile-dropdown-item, .profile-header-link').forEach(item => {
    item.addEventListener('click', () => {
      closeDropdown(false);
    });
  });

  // Handle logout form submit: pause playback immediately, clear audio element, and close dropdown
  const logoutForm = document.getElementById('profileLogoutForm');
  if (logoutForm) {
    logoutForm.addEventListener('submit', () => {
      closeDropdown(false);
      if (window.havenAudio) {
        try {
          window.havenAudio.pause();
          window.havenAudio.src = '';
        } catch (_) {}
      }
    });
  }
}
window.initProfileDropdown = initProfileDropdown;

/**
 * Profile Avatar Customization (Built-in Presets, Device Upload & Default Reset)
 * Supports live preview, client-side validation, AJAX submission, and instant DOM synchronization
 * across navbar, dropdown menu, and profile page.
 */
function initProfileAvatarCustomization() {
  const form = document.getElementById('avatarCustomizationForm');
  if (!form) return;

  const presetCards = form.querySelectorAll('.avatar-preset-card');
  const fileInput = document.getElementById('avatarFileInput');
  const uploadBtn = document.getElementById('uploadAvatarBtn');
  const resetBtn = document.getElementById('resetDefaultAvatarBtn');
  const saveBtn = document.getElementById('saveAvatarBtn');
  const saveBtnText = document.getElementById('saveAvatarBtnText');
  const stagedBadge = document.getElementById('stagedFileName');
  const feedbackAlert = document.getElementById('avatarFeedbackAlert');
  const presetHidden = document.getElementById('selectedAvatarPreset');
  const actionHidden = document.getElementById('avatarActionInput');

  const pageContainer = document.getElementById('profilePageAvatarContainer');
  const navContainer = document.getElementById('navbarAvatarContainer');
  const dropContainer = document.getElementById('dropdownAvatarContainer');

  function getCsrfToken() {
    const formToken = form.querySelector('input[name="csrfmiddlewaretoken"]')?.value;
    if (formToken) return formToken;
    const globalToken = document.querySelector('#globalCsrfForm input[name="csrfmiddlewaretoken"]')?.value;
    if (globalToken) return globalToken;
    const anyToken = document.querySelector('input[name="csrfmiddlewaretoken"]')?.value;
    if (anyToken) return anyToken;
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function showAlert(type, message) {
    if (!feedbackAlert) return;
    feedbackAlert.className = `avatar-feedback-alert is-${type}`;
    feedbackAlert.textContent = message;
    feedbackAlert.style.display = 'flex';
  }

  function hideAlert() {
    if (!feedbackAlert) return;
    feedbackAlert.style.display = 'none';
  }

  function syncAllAvatarContainers(avatarUrl) {
    function setAvatarImg(container, imgClass, imgId) {
      if (!container) return;
      const src = avatarUrl || '/static/music/images/avatars/default-avatar.png';
      container.innerHTML = `<img src="${src}" alt="Profile Avatar" class="${imgClass}" id="${imgId}">`;
    }
    setAvatarImg(pageContainer, 'profile-page-avatar-img', 'profilePageAvatarImg');
    setAvatarImg(navContainer, 'profile-avatar-img', 'navbarAvatarImg');
    setAvatarImg(dropContainer, 'profile-header-img', 'dropdownAvatarImg');
  }

  // 1. Built-in Preset Card Clicks
  presetCards.forEach(card => {
    card.addEventListener('click', () => {
      hideAlert();
      presetCards.forEach(c => {
        c.classList.remove('is-selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('is-selected');
      card.setAttribute('aria-pressed', 'true');

      const presetId = card.getAttribute('data-preset-id');
      const presetUrl = card.getAttribute('data-preset-url');

      if (presetHidden) presetHidden.value = presetId;
      if (actionHidden) actionHidden.value = 'preset';
      if (fileInput) fileInput.value = '';
      if (stagedBadge) {
        stagedBadge.style.display = 'none';
        stagedBadge.textContent = '';
      }

      // Live preview on profile page
      if (pageContainer && presetUrl) {
        pageContainer.innerHTML = `<img src="${presetUrl}" alt="${card.querySelector('.avatar-preset-name')?.textContent || 'Preset'}" class="profile-page-avatar-img" id="profilePageAvatarImg">`;
      }
    });
  });

  // 2. Upload Button Clicks
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }

  // 3. File Input Change
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      hideAlert();
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
      if (file.size > MAX_SIZE) {
        showAlert('error', 'Image file exceeds the 5 MB maximum size limit.');
        fileInput.value = '';
        return;
      }

      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const ext = file.name.split('.').pop().toLowerCase();
      const validExts = ['jpg', 'jpeg', 'png', 'webp'];
      if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
        showAlert('error', 'Unsupported file format. Please upload a JPEG, PNG, or WebP image.');
        fileInput.value = '';
        return;
      }

      // Unselect presets
      presetCards.forEach(c => {
        c.classList.remove('is-selected');
        c.setAttribute('aria-pressed', 'false');
      });
      if (presetHidden) presetHidden.value = '';
      if (actionHidden) actionHidden.value = 'upload';

      // Show staged file badge
      if (stagedBadge) {
        stagedBadge.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        stagedBadge.style.display = 'inline-flex';
      }

      // Live preview via FileReader
      const reader = new FileReader();
      reader.onload = (e) => {
        if (pageContainer) {
          pageContainer.innerHTML = `<img src="${e.target.result}" alt="Preview" class="profile-page-avatar-img" id="profilePageAvatarImg">`;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // 4. Reset Default Button
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      hideAlert();

      // Unselect presets
      presetCards.forEach(c => {
        c.classList.remove('is-selected');
        c.setAttribute('aria-pressed', 'false');
      });
      if (fileInput) fileInput.value = '';
      if (stagedBadge) {
        stagedBadge.style.display = 'none';
        stagedBadge.textContent = '';
      }
      if (presetHidden) presetHidden.value = 'default';
      if (actionHidden) actionHidden.value = 'reset_default';

      // Live preview reset to default headset boy avatar
      if (pageContainer) {
        pageContainer.innerHTML = `<img src="/static/music/images/avatars/default-avatar.png" alt="Default Avatar" class="profile-page-avatar-img" id="profilePageAvatarImg">`;
      }
    });
  }

  // 5. Form Submit (AJAX with robust CSRF and real-time DOM synchronization)
  if (!form.dataset.avatarBound) {
    form.dataset.avatarBound = 'true';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const action = actionHidden ? actionHidden.value : '';
      const preset = presetHidden ? presetHidden.value : '';
      const file = fileInput ? (fileInput.files && fileInput.files[0]) : null;

      // If user hasn't made any selection
      if (!action && !preset && !file) {
        showAlert('error', 'Please select an avatar preset or choose an image file to upload.');
        return;
      }

      if (saveBtn) saveBtn.disabled = true;
      if (saveBtnText) saveBtnText.textContent = 'Saving...';

      const formData = new FormData(form);
      const csrfToken = getCsrfToken();
      if (csrfToken && !formData.has('csrfmiddlewaretoken')) {
        formData.append('csrfmiddlewaretoken', csrfToken);
      }

      const headers = {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const endpointUrl = form.getAttribute('action') || form.action || '/profile/avatar/';

      try {
        const res = await fetch(endpointUrl, {
          method: 'POST',
          headers: headers,
          body: formData
        });

        // 1. Check for redirects (e.g. login required or session expired)
        if (res.redirected && res.url && res.url.includes('/login')) {
          window.location.href = res.url;
          return;
        }

        // 2. Safe response parsing without unhandled SyntaxError
        const contentType = res.headers.get('content-type') || '';
        let data = null;

        if (contentType.includes('application/json')) {
          try {
            data = await res.json();
          } catch (jsonErr) {
            console.warn('Failed to parse JSON response:', jsonErr);
            data = null;
          }
        } else {
          // HTML error page or text response
          try {
            const errorHtml = await res.text();
            if (res.status === 403) {
              showAlert('error', 'CSRF verification failed or permission denied. Please reload the page and try again.');
              return;
            } else if (!res.ok) {
              showAlert('error', `Server error (${res.status}). Please try again later.`);
              return;
            }
          } catch (_) {}
        }

        if (!res.ok || !data || !data.success) {
          const errMsg = data?.error || data?.message || `Failed to update profile avatar (${res.status}). Please try again.`;
          showAlert('error', errMsg);
          return;
        }

        // 3. Success: Show confirmation and synchronize all UI components
        showAlert('success', data.message || 'Profile avatar updated successfully!');
        syncAllAvatarContainers(data.avatar_url);

        // 4. Update form state according to saved avatar
        if (data.is_default) {
          if (fileInput) fileInput.value = '';
          if (presetHidden) presetHidden.value = '';
          if (actionHidden) actionHidden.value = '';
          if (stagedBadge) stagedBadge.style.display = 'none';
        } else if (data.preset) {
          if (presetHidden) presetHidden.value = data.preset;
          if (actionHidden) actionHidden.value = '';
          if (fileInput) fileInput.value = '';
          if (stagedBadge) stagedBadge.style.display = 'none';
        } else {
          if (presetHidden) presetHidden.value = '';
          if (actionHidden) actionHidden.value = '';
          if (fileInput) fileInput.value = '';
          if (stagedBadge) stagedBadge.style.display = 'none';
        }

        if (typeof window.showPlaylistToast === 'function') {
          window.showPlaylistToast('success', data.message || 'Avatar updated successfully.');
        }
      } catch (err) {
        console.warn('Avatar update request error:', err);
        showAlert('error', 'Network error occurred while connecting to the server. Please check your connection and try again.');
      } finally {
        if (saveBtn) saveBtn.disabled = false;
        if (saveBtnText) saveBtnText.textContent = 'Save Changes';
      }
    });
  }
}
window.initProfileAvatarCustomization = initProfileAvatarCustomization;

/**
 * Active navbar section tracking & smooth navigation (Home Page)
 * Uses IntersectionObserver & viewport probe detection to highlight the visible section
 */
let currentScrollSpyObserver = null;
let isScrollSpyScrollBound = false;

function initNavbarScrollSpy() {
  if (currentScrollSpyObserver) {
    currentScrollSpyObserver.disconnect();
    currentScrollSpyObserver = null;
  }

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
    currentScrollSpyObserver = new IntersectionObserver(() => {
      if (!isManualClick) {
        updateActiveSection();
      }
    }, {
      rootMargin: '-15% 0px -40% 0px',
      threshold: [0, 0.2]
    });

    observedElements.forEach(el => currentScrollSpyObserver.observe(el));
  }

  // Scroll listener with requestAnimationFrame for fluid continuous tracking
  if (!isScrollSpyScrollBound) {
    isScrollSpyScrollBound = true;
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
  }

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
  window.openAuthPrompt = function(title = 'Please log in to listen to music.', subtitle = 'Sign in or create a Haven account to listen to full songs and albums.') {
    if (modalTitle) modalTitle.textContent = title;
    if (modalSubtitle) modalSubtitle.textContent = subtitle;

    // Dynamically preserve destination URL for login and signup buttons
    const currentPath = window.location.pathname + window.location.search;
    const loginLink = modalOverlay.querySelector('#authModalLoginBtn') || modalOverlay.querySelector('a[href^="/login"]');
    if (loginLink) {
      if (currentPath && !currentPath.startsWith('/login') && !currentPath.startsWith('/signup')) {
        loginLink.href = `/login/?next=${encodeURIComponent(currentPath)}`;
      } else {
        loginLink.href = '/login/';
      }
    }
    const signupLink = modalOverlay.querySelector('#authModalSignupBtn') || modalOverlay.querySelector('a[href^="/signup"]');
    if (signupLink) {
      if (currentPath && !currentPath.startsWith('/login') && !currentPath.startsWith('/signup')) {
        signupLink.href = `/signup/?next=${encodeURIComponent(currentPath)}`;
      } else {
        signupLink.href = '/signup/';
      }
    }

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
 * User Authentication Helper
 * Checks body data-attribute and navbar user profile badge
 */
function isUserAuthenticated() {
  if (document.body && document.body.getAttribute('data-authenticated') === 'true') return true;
  if (document.body && document.body.getAttribute('data-authenticated') === 'false') return false;
  return !!document.querySelector('.user-profile-badge');
}

/**
 * Password Visibility Toggle for Authentication Forms (Login & Signup)
 * Switches password input between type="password" and type="text" while preserving value.
 * Fully keyboard-accessible with updated ARIA labels.
 */
function initPasswordToggles() {
  const toggleButtons = document.querySelectorAll('.auth-password-toggle:not([data-toggle-bound])');
  toggleButtons.forEach(button => {
    button.setAttribute('data-toggle-bound', 'true');
    button.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      const targetId = this.getAttribute('data-toggle-target');
      const targetInput = targetId
        ? document.getElementById(targetId)
        : this.closest('.auth-input-wrapper')?.querySelector('input');
      if (!targetInput) return;

      const eyeOpen = this.querySelector('.eye-open');
      const eyeClosed = this.querySelector('.eye-closed');

      const isCurrentlyPassword = (targetInput.type === 'password');
      if (isCurrentlyPassword) {
        targetInput.type = 'text';
        this.setAttribute('aria-label', 'Hide password');
        this.setAttribute('title', 'Hide password');
        if (eyeOpen) eyeOpen.style.display = 'none';
        if (eyeClosed) eyeClosed.style.display = 'block';
      } else {
        targetInput.type = 'password';
        this.setAttribute('aria-label', 'Show password');
        this.setAttribute('title', 'Show password');
        if (eyeOpen) eyeOpen.style.display = 'block';
        if (eyeClosed) eyeClosed.style.display = 'none';
      }
    });
  });
}

// Global delegated click handler fallback for password toggles
document.addEventListener('click', (e) => {
  const button = e.target.closest('.auth-password-toggle');
  if (!button || button.hasAttribute('data-toggle-bound')) return;

  e.preventDefault();
  const targetId = button.getAttribute('data-toggle-target');
  const targetInput = targetId
    ? document.getElementById(targetId)
    : button.closest('.auth-input-wrapper')?.querySelector('input');
  if (!targetInput) return;

  const eyeOpen = button.querySelector('.eye-open');
  const eyeClosed = button.querySelector('.eye-closed');

  const isCurrentlyPassword = (targetInput.type === 'password');
  if (isCurrentlyPassword) {
    targetInput.type = 'text';
    button.setAttribute('aria-label', 'Hide password');
    button.setAttribute('title', 'Hide password');
    if (eyeOpen) eyeOpen.style.display = 'none';
    if (eyeClosed) eyeClosed.style.display = 'block';
  } else {
    targetInput.type = 'password';
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('title', 'Show password');
    if (eyeOpen) eyeOpen.style.display = 'block';
    if (eyeClosed) eyeClosed.style.display = 'none';
  }
});

/**
 * Client-Side Signup Password Confirmation Validation
 */
function initSignupValidation() {
  const form = document.getElementById('signupForm');
  const pass = document.getElementById('id_password');
  const confirmPass = document.getElementById('id_confirm_password');

  if (form && pass && confirmPass && !form.hasAttribute('data-val-bound')) {
    form.setAttribute('data-val-bound', 'true');
    form.addEventListener('submit', function (e) {
      if (pass.value !== confirmPass.value) {
        e.preventDefault();
        confirmPass.setCustomValidity('Passwords do not match');
        confirmPass.reportValidity();
      } else {
        confirmPass.setCustomValidity('');
      }
    });

    confirmPass.addEventListener('input', function () {
      if (pass.value === confirmPass.value) {
        confirmPass.setCustomValidity('');
      }
    });
  }
}

/**
 * Handle locked music items (Albums, Songs)
 */
function initLockedItems() {
  const lockedItems = document.querySelectorAll('[data-locked="true"]:not([data-locked-bound])');

  lockedItems.forEach(item => {
    item.setAttribute('data-locked-bound', 'true');
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const title = item.getAttribute('data-title') || 'This Album';
      if (typeof window.openAuthPrompt === 'function') {
        const isLibrary = (title.toLowerCase() === 'your library');
        const isPlaylists = (title.toLowerCase() === 'create playlists' || title.toLowerCase() === 'playlists');
        const promptTitle = isLibrary
          ? 'Sign in to access Your Library'
          : (isPlaylists ? 'Sign in to create Playlists' : `Listen to "${title}"`);
        const promptSubtitle = isLibrary
          ? 'Sign in or create a Haven account to view your saved favorite songs.'
          : (isPlaylists
              ? 'Sign in or create a Haven account to build and manage your personal playlists.'
              : 'Sign in to Haven to stream full albums, create personalized playlists, and follow your favorite artists.');
        window.openAuthPrompt(promptTitle, promptSubtitle);
      } else {
        const isLibrary = (title.toLowerCase() === 'your library');
        const isPlaylists = (title.toLowerCase() === 'create playlists' || title.toLowerCase() === 'playlists');
        const nextUrl = isLibrary ? '/liked-songs/' : (isPlaylists ? '/playlists/' : '/');
        window.location.href = `/login/?next=${encodeURIComponent(nextUrl)}`;
      }
    });
  });

  // "Start Listening" / "Explore Music" button scrolls to albums
  const exploreBtn = document.getElementById('exploreMusicBtn');
  if (exploreBtn && !exploreBtn.hasAttribute('data-bound')) {
    exploreBtn.setAttribute('data-bound', 'true');
    exploreBtn.addEventListener('click', (e) => {
      const albumsSection = document.getElementById('popular-albums');
      if (albumsSection) {
        albumsSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

/**
 * Popular Albums "View All" expansion
 * Reveals remaining albums in a horizontal scrollable row and hides View All button
 */
function initViewAllAlbums() {
  const viewAllBtn = document.getElementById('viewAllAlbumsBtn');
  const albumsGrid = document.getElementById('albumsGrid');

  if (!viewAllBtn || !albumsGrid) return;
  if (viewAllBtn.hasAttribute('data-bound')) return;
  viewAllBtn.setAttribute('data-bound', 'true');

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
  if (viewAllBtn.hasAttribute('data-bound')) return;
  viewAllBtn.setAttribute('data-bound', 'true');

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
  if (!element || element.hasAttribute('data-scroll-bound')) return;
  element.setAttribute('data-scroll-bound', 'true');

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
  const miniPlayer = document.getElementById('miniPlayer');
  if (!miniPlayer) return;

  // Mini Player Elements
  const miniPlayerTrack = document.getElementById('miniPlayerTrack');
  const miniCover = document.getElementById('miniPlayerCover');
  const miniTitle = document.getElementById('miniPlayerTitle');
  const miniArtist = document.getElementById('miniPlayerArtist');
  const miniPlayBtn = document.getElementById('miniPlayBtn');
  const miniPrevBtn = document.getElementById('miniPrevBtn');
  const miniNextBtn = document.getElementById('miniNextBtn');
  const miniCloseBtn = document.getElementById('miniCloseBtn');
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
  let currentTrack = null;
  let isSeeking = false;
  let seekEndTimeout = null;
  let currentVolume = 1;
  let isMuted = false;
  let prevVolumeBeforeMute = 1;
  let isShuffle = false;
  let repeatMode = 'off'; // 'off' | 'all' | 'one'
  let currentPlaylist = [];
  let currentPlaylistIndex = 0;

  // Listening History Tracker State
  let listenTracker = {
    songId: null,
    audioUrl: null,
    hasRecorded: false,
    durationThreshold: 4 // seconds of active playback required
  };

  function getPlayerCsrfToken() {
    const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input && input.value) return input.value;
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1] : '';
  }

  function resetHistoryTracker(trackData) {
    listenTracker.songId = trackData ? (trackData.id || '') : '';
    listenTracker.audioUrl = trackData ? (trackData.audio || '') : '';
    listenTracker.hasRecorded = false;
  }

  function recordListeningHistory(trackData) {
    if (listenTracker.hasRecorded) return;
    if (!isUserAuthenticated()) return;

    listenTracker.hasRecorded = true;
    const songId = trackData?.id || listenTracker.songId;
    const audioUrl = trackData?.audio || listenTracker.audioUrl;

    const csrf = getPlayerCsrfToken();
    fetch('/history/record/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        song_id: songId,
        audio_url: audioUrl
      })
    })
    .then(res => res.json())
    .then(data => {
      // Play recorded in history
    })
    .catch(err => {
      console.warn('Failed to record listening history:', err);
    });
  }

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
    } else if (currentTrack) {
      updateTrackDisplays(currentTrack);
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

  function closeAndResetPlayer() {
    // 1. Stop audio immediately
    if (currentAudio) {
      const oldAudio = currentAudio;
      currentAudio = null;
      oldAudio.pause();
      oldAudio.currentTime = 0;
      oldAudio.src = '';
    }

    // 2. Reset song list item buttons
    if (currentButton) {
      setPlayingState(currentButton, false);
      currentButton = null;
    }
    currentTrack = null;
    document.querySelectorAll('.song-list-item.playing, .song-play-btn.playing').forEach(el => {
      el.classList.remove('playing');
      const playIcon = el.querySelector('.icon-play');
      const pauseIcon = el.querySelector('.icon-pause');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
    });

    // 3. Reset progress & sliders
    isSeeking = false;
    if (miniSeekSlider) {
      miniSeekSlider.value = 0;
      miniSeekSlider.style.setProperty('--seek-pct', '0%');
    }
    if (fsSeekSlider) {
      fsSeekSlider.value = 0;
      fsSeekSlider.style.setProperty('--seek-pct', '0%');
    }
    if (miniCurrentTime) miniCurrentTime.textContent = '0:00';
    if (miniTotalTime) miniTotalTime.textContent = '0:00';
    if (fsCurrentTime) fsCurrentTime.textContent = '0:00';
    if (fsTotalTime) fsTotalTime.textContent = '0:00';

    // 4. Sync play buttons to show play icon
    syncPlayerPlayButtons(false);

    // 5. Hide bottom mini-player
    if (miniPlayer) {
      miniPlayer.classList.remove('visible');
      miniPlayer.style.display = 'none';
    }
    document.body.classList.remove('has-mini-player');

    // 6. Close full-screen player if open
    closeFullscreenPlayer();

    // 7. Clear active track & playlist state
    currentPlaylist = [];
    currentPlaylistIndex = 0;
    resetHistoryTracker(null);
  }

  function updatePlaylistFromPage(activeBtn) {
    const buttons = Array.from(document.querySelectorAll('.song-play-btn[data-audio]:not([disabled])'));
    if (!buttons.length) {
      currentPlaylist = [];
      currentPlaylistIndex = 0;
      return;
    }

    const pageAlbumTitle = document.querySelector('.album-hero-title')?.textContent.trim() || 'Haven Stream';
    const pageCover = document.querySelector('.album-hero-cover-img')?.getAttribute('src') || '';
    currentPlaylist = buttons.map(btn => {
      const item = btn.closest('.song-list-item');
      const songId = btn.getAttribute('data-song-id') || item?.getAttribute('data-song-id') || item?.querySelector('[data-song-id]')?.getAttribute('data-song-id') || '';
      return {
        id: songId,
        audio: btn.getAttribute('data-audio'),
        title: btn.getAttribute('data-title') || item?.querySelector('.song-title')?.textContent.trim() || 'Song',
        artist: btn.getAttribute('data-artist') || item?.querySelector('.song-artist-sub')?.textContent.trim() || 'Artist',
        cover: btn.getAttribute('data-cover') || pageCover,
        album: btn.getAttribute('data-album') || pageAlbumTitle
      };
    });

    let foundIndex = -1;
    if (activeBtn) {
      foundIndex = buttons.indexOf(activeBtn);
    }
    if (foundIndex === -1 && currentTrack && currentTrack.audio) {
      foundIndex = buttons.findIndex(btn => btn.getAttribute('data-audio') === currentTrack.audio);
    }
    if (foundIndex === -1 && currentAudio && currentAudio.src) {
      foundIndex = buttons.findIndex(btn => currentAudio.src.includes(btn.getAttribute('data-audio')));
    }

    if (foundIndex !== -1) {
      currentPlaylistIndex = foundIndex;
      currentButton = buttons[foundIndex];
    } else {
      // Current track is not in the updated queue (e.g. removed while playing or from another page)
      currentPlaylistIndex = Math.max(0, Math.min(currentPlaylistIndex, buttons.length - 1));
      currentButton = null;
    }
  }

  // Update Track Info across Mini Player and Full-Screen Player
  function updateTrackDisplays(itemData) {
    if (!itemData) return;
    let title = 'Song';
    let artist = 'Artist';
    let cover = '';
    let album = 'Haven Stream';

    if (itemData instanceof HTMLElement) {
      const item = itemData.closest('.song-list-item');
      title = itemData.getAttribute('data-title') || item?.querySelector('.song-title')?.textContent.trim() || 'Song';
      artist = itemData.getAttribute('data-artist') || item?.querySelector('.song-artist-sub')?.textContent.trim() || 'Artist';
      cover = itemData.getAttribute('data-cover') || document.querySelector('.album-hero-cover-img')?.getAttribute('src') || '';
      album = document.querySelector('.album-hero-title')?.textContent.trim() || 'Haven Stream';
    } else {
      title = itemData.title || 'Song';
      artist = itemData.artist || 'Artist';
      cover = itemData.cover || '';
      album = itemData.album || 'Haven Stream';
    }

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
    const fsHeaderTitle = document.getElementById('fsHeaderAlbumTitle');
    if (fsHeaderTitle && album) fsHeaderTitle.textContent = album;
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
    if (!isUserAuthenticated()) {
      if (currentAudio) currentAudio.pause();
      return;
    }

    if (isAutoAdvance && repeatMode === 'one') {
      if (currentAudio) {
        currentAudio.currentTime = 0;
        currentAudio.play().then(() => {
          if (currentButton) setPlayingState(currentButton, true);
          else syncPlayerPlayButtons(true);
        }).catch(err => {
          console.warn('Playback error:', err);
        });
      }
      return;
    }

    const playableButtons = getPlayableButtons();
    if (!currentPlaylist.length && playableButtons.length) {
      updatePlaylistFromPage(playableButtons[0]);
    }

    if (!currentPlaylist.length) return;

    // Single-track queue handling: restart track rather than toggle-pause
    if (currentPlaylist.length === 1) {
      if (isAutoAdvance && repeatMode === 'off') {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
        if (currentButton) setPlayingState(currentButton, false);
        syncPlayerPlayButtons(false);
        updateProgress();
        return;
      }
      currentPlaylistIndex = 0;
      if (currentAudio) {
        currentAudio.currentTime = 0;
        updateProgress();
        currentAudio.play().then(() => {
          if (currentButton) setPlayingState(currentButton, true);
          else syncPlayerPlayButtons(true);
        }).catch(err => console.warn('Playback error:', err));
      } else {
        const nextTrack = currentPlaylist[0];
        const matchingBtn = document.querySelector(`.song-play-btn[data-audio="${CSS.escape(nextTrack.audio)}"]`);
        playTrack(nextTrack, matchingBtn || null);
      }
      return;
    }

    let nextIndex = currentPlaylistIndex;

    if (isShuffle && currentPlaylist.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * currentPlaylist.length);
      } while (nextIndex === currentPlaylistIndex);
    } else {
      if (currentPlaylistIndex < currentPlaylist.length - 1) {
        nextIndex = currentPlaylistIndex + 1;
      } else {
        if (isAutoAdvance) {
          if (repeatMode === 'all') {
            nextIndex = 0;
          } else {
            if (currentAudio) {
              currentAudio.pause();
              currentAudio.currentTime = 0;
            }
            if (currentButton) setPlayingState(currentButton, false);
            syncPlayerPlayButtons(false);
            updateProgress();
            return;
          }
        } else {
          nextIndex = 0;
        }
      }
    }

    currentPlaylistIndex = nextIndex;
    const nextTrack = currentPlaylist[nextIndex];
    if (!nextTrack) return;

    const matchingBtn = document.querySelector(`.song-play-btn[data-audio="${CSS.escape(nextTrack.audio)}"]`);
    playTrack(nextTrack, matchingBtn || null);
  }

  // Previous Track Logic
  function playPrevSong() {
    if (!isUserAuthenticated()) {
      if (currentAudio) currentAudio.pause();
      return;
    }

    if (currentAudio && currentAudio.currentTime > 3) {
      currentAudio.currentTime = 0;
      updateProgress();
      return;
    }

    const playableButtons = getPlayableButtons();
    if (!currentPlaylist.length && playableButtons.length) {
      updatePlaylistFromPage(playableButtons[0]);
    }

    if (!currentPlaylist.length) return;

    // Single-track queue handling: restart track rather than toggle-pause
    if (currentPlaylist.length === 1) {
      if (currentAudio) {
        currentAudio.currentTime = 0;
        updateProgress();
        currentAudio.play().then(() => {
          if (currentButton) setPlayingState(currentButton, true);
          else syncPlayerPlayButtons(true);
        }).catch(err => console.warn('Playback error:', err));
      }
      return;
    }

    let prevIndex = (currentPlaylistIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    currentPlaylistIndex = prevIndex;
    const prevTrack = currentPlaylist[prevIndex];
    if (!prevTrack) return;

    const matchingBtn = document.querySelector(`.song-play-btn[data-audio="${CSS.escape(prevTrack.audio)}"]`);
    playTrack(prevTrack, matchingBtn || null);
  }

  // Toggle Play/Pause on current track
  function togglePlayPause() {
    if (!isUserAuthenticated()) {
      if (currentAudio) currentAudio.pause();
      const currentPath = window.location.pathname + window.location.search;
      if (typeof window.openAuthPrompt === 'function') {
        window.openAuthPrompt('Please log in to listen to music.', 'Sign in or create a Haven account to listen to full songs and albums.');
      } else {
        window.location.href = `/login/?next=${encodeURIComponent(currentPath)}`;
      }
      return;
    }

    if (!currentAudio) {
      const firstBtn = document.querySelector('.song-play-btn[data-audio]:not([disabled])');
      if (firstBtn) {
        firstBtn.click();
      } else if (currentPlaylist.length > 0) {
        const track = currentPlaylist[currentPlaylistIndex || 0];
        playTrack(track, null);
      }
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

  // Central Audio Playback Handler
  function playTrack(trackData, buttonEl = null) {
    if (!trackData || !trackData.audio) return;

    if (!isUserAuthenticated()) {
      if (currentAudio) {
        currentAudio.pause();
      }
      const currentPath = window.location.pathname + window.location.search;
      if (typeof window.openAuthPrompt === 'function') {
        window.openAuthPrompt('Please log in to listen to music.', 'Sign in or create a Haven account to listen to full songs and albums.');
      } else {
        window.location.href = `/login/?next=${encodeURIComponent(currentPath)}`;
      }
      return;
    }

    // If clicking currently playing song
    if (currentAudio && currentAudio.src.includes(trackData.audio)) {
      if (buttonEl) currentButton = buttonEl;
      if (currentAudio.paused) {
        // If track has ended or is near the end, reset to 0 before replay
        if (currentAudio.ended || (currentAudio.duration && currentAudio.currentTime >= currentAudio.duration - 0.2)) {
          currentAudio.currentTime = 0;
          resetHistoryTracker(trackData);
          updateProgress();
        }
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
      return;
    }

    // Stop and reset existing audio cleanly
    if (currentAudio) {
      const oldAudio = currentAudio;
      currentAudio = null;
      oldAudio.pause();
      oldAudio.currentTime = 0;
      oldAudio.src = '';
    }
    if (currentButton) {
      setPlayingState(currentButton, false);
      currentButton = null;
    }

    currentTrack = trackData;
    currentButton = buttonEl;
    resetHistoryTracker(trackData);

    // Start new song using single Audio instance
    const audio = new Audio(trackData.audio);
    audio.volume = isMuted ? 0 : currentVolume;
    currentAudio = audio;

    audio.addEventListener('error', () => {
      if (!isUserAuthenticated()) {
        if (typeof window.openAuthPrompt === 'function') {
          window.openAuthPrompt('Please log in to listen to music.', 'Sign in or create a Haven account to listen to full songs and albums.');
        }
      }
    });

    updateTrackDisplays(trackData);
    showMiniPlayer();

    audio.play().then(() => {
      if (currentAudio === audio) {
        if (currentButton) setPlayingState(currentButton, true);
        else syncPlayerPlayButtons(true);
      }
    }).catch(err => {
      console.warn('Playback error:', err);
      if (currentAudio === audio) {
        if (currentButton) setPlayingState(currentButton, false);
        else syncPlayerPlayButtons(false);
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (currentAudio !== audio) return;
      updateProgress();

      // Meaningful listening duration threshold: record once active playback passes threshold
      if (!listenTracker.hasRecorded && isUserAuthenticated() && audio.currentTime >= listenTracker.durationThreshold) {
        recordListeningHistory(trackData);
      }
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
      if (!listenTracker.hasRecorded && isUserAuthenticated()) {
        recordListeningHistory(trackData);
      }
      playNextSong(true);
    });

    audio.addEventListener('pause', () => {
      if (currentAudio !== audio) return;
      if (audio.paused && !audio.seeking && !isSeeking) {
        if (currentButton) setPlayingState(currentButton, false);
        else syncPlayerPlayButtons(false);
      }
    });

    audio.addEventListener('play', () => {
      if (currentAudio !== audio) return;
      if (currentButton) setPlayingState(currentButton, true);
      else syncPlayerPlayButtons(true);
    });

    audio.addEventListener('playing', () => {
      if (currentAudio !== audio) return;
      if (currentButton) setPlayingState(currentButton, true);
      else syncPlayerPlayButtons(true);
    });
  }

  // Synchronize on-page track row buttons with active playback
  function syncActiveSongRow() {
    if (!currentAudio || !currentTrack) return;

    // Reset on-page track row play icons
    document.querySelectorAll('.song-list-item.playing, .song-play-btn.playing').forEach(el => {
      el.classList.remove('playing');
      const playIcon = el.querySelector('.icon-play');
      const pauseIcon = el.querySelector('.icon-pause');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
    });

    const matchingBtn = document.querySelector(`.song-play-btn[data-audio="${CSS.escape(currentTrack.audio)}"]`);
    if (matchingBtn) {
      currentButton = matchingBtn;
      setPlayingState(matchingBtn, !currentAudio.paused);
    } else {
      currentButton = null;
    }
  }

  // Bind track rows & play buttons on the current page
  function bindSongItems() {
    const songItems = document.querySelectorAll('.song-list-item:not([data-bound])');
    songItems.forEach(item => {
      item.setAttribute('data-bound', 'true');
      const btn = item.querySelector('.song-play-btn');
      if (!btn) return;

      const audioUrl = btn.getAttribute('data-audio');
      if (!audioUrl) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (!isUserAuthenticated()) {
          const currentPath = window.location.pathname + window.location.search;
          if (typeof window.openAuthPrompt === 'function') {
            window.openAuthPrompt('Please log in to listen to music.', 'Sign in or create a Haven account to listen to full songs and albums.');
          } else {
            window.location.href = `/login/?next=${encodeURIComponent(currentPath)}`;
          }
          return;
        }

        const songId = btn.getAttribute('data-song-id') || item.getAttribute('data-song-id') || item.querySelector('[data-song-id]')?.getAttribute('data-song-id') || '';
        const trackData = {
          id: songId,
          audio: audioUrl,
          title: btn.getAttribute('data-title') || item.querySelector('.song-title')?.textContent.trim() || 'Song',
          artist: btn.getAttribute('data-artist') || item.querySelector('.song-artist-sub')?.textContent.trim() || 'Artist',
          cover: btn.getAttribute('data-cover') || item.querySelector('img')?.getAttribute('src') || document.querySelector('.album-hero-cover-img')?.getAttribute('src') || '',
          album: btn.getAttribute('data-album') || document.querySelector('.album-hero-title')?.textContent.trim() || 'Haven Stream'
        };

        updatePlaylistFromPage(btn);
        playTrack(trackData, btn);
      });

      // Clicking the song row also triggers the play button (ignores drag handle, buttons, links, inputs)
      item.addEventListener('click', (e) => {
        if (e.target.closest('.song-play-btn') ||
            e.target.closest('.song-drag-handle') ||
            e.target.closest('.song-like-btn') ||
            e.target.closest('.song-add-playlist-btn') ||
            e.target.closest('.song-remove-playlist-btn') ||
            e.target.closest('a') ||
            e.target.closest('button') ||
            e.target.closest('input')) {
          return;
        }
        btn.click();
      });
    });

    // "Play Album" / "Play All" button in hero plays first song or toggles playback
    const playAlbumButtons = document.querySelectorAll('.album-play-all-btn:not([data-bound])');
    playAlbumButtons.forEach(playAlbumBtn => {
      playAlbumBtn.setAttribute('data-bound', 'true');
      playAlbumBtn.addEventListener('click', () => {
        if (!isUserAuthenticated()) {
          const currentPath = window.location.pathname + window.location.search;
          if (typeof window.openAuthPrompt === 'function') {
            window.openAuthPrompt('Please log in to listen to music.', 'Sign in or create a Haven account to listen to full songs and albums.');
          } else {
            window.location.href = `/login/?next=${encodeURIComponent(currentPath)}`;
          }
          return;
        }

        const pageButtons = Array.from(document.querySelectorAll('.song-play-btn[data-audio]:not([disabled])'));
        if (!pageButtons.length) return;

        const pageAudios = pageButtons.map(btn => btn.getAttribute('data-audio'));
        const queueAudios = currentPlaylist.map(t => t.audio);

        // Compare actual queue sequence to know if we are already playing this exact list
        const isSameQueue = queueAudios.length > 0 &&
                            queueAudios.length === pageAudios.length &&
                            queueAudios.every((aud, idx) => aud === pageAudios[idx]);

        if (isSameQueue && currentAudio) {
          // Exactly the same queue: toggle play/pause as expected
          togglePlayPause();
        } else {
          // Different queue, or no track playing yet: initialize playback from first track
          const firstBtn = pageButtons[0];
          firstBtn?.click();
        }
      });
    });

    syncActiveSongRow();
  }

  // Expose rebind function for PJAX page transitions
  window.rebindSongItems = bindSongItems;
  window.syncPlayerQueue = function() {
    const pageButtons = Array.from(document.querySelectorAll('.song-play-btn[data-audio]:not([disabled])'));
    const isPlayingFromThisPage = !currentTrack || pageButtons.some(btn => btn.getAttribute('data-audio') === currentTrack.audio);
    if (isPlayingFromThisPage) {
      updatePlaylistFromPage(currentButton || null);
    }
  };
  bindSongItems();

  // Mini Player Open Full-Screen Triggers
  miniPlayer?.addEventListener('click', (e) => {
    // Prevent opening if user clicked interactive mini controls
    if (e.target.closest('.mini-ctrl-btn') ||
        e.target.closest('.mini-player-close-btn') ||
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

  // Mini Player Close Button (×)
  if (miniCloseBtn) {
    miniCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAndResetPlayer();
    });
    miniCloseBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    miniCloseBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  }

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

  // Expose global playback function for live search autocomplete
  window.playSongTrack = function(trackData) {
    if (!trackData || !trackData.audio) return;
    currentPlaylist = [trackData];
    currentPlaylistIndex = 0;
    const matchingBtn = document.querySelector(`.song-play-btn[data-audio="${CSS.escape(trackData.audio)}"]`);
    playTrack(trackData, matchingBtn || null);
  };
}

/**
 * Live search autocomplete suggestions dropdown
 * Features:
 * - Independent name-only matching across Songs, Artists, and Albums
 * - Debounced input queries (200ms)
 * - Cache for fast repeat lookups
 * - Full keyboard navigation (Arrow Up, Arrow Down, Enter, Esc)
 * - Direct playback on song suggestion click
 * - Direct navigation on artist / album suggestion click
 * - Close on click-outside
 */
function initSearchAutocomplete() {
  const searchInput = document.getElementById('navSearchInput') || document.querySelector('.search-input');
  const searchForm = document.getElementById('navSearchForm') || document.querySelector('.nav-search');
  const dropdown = document.getElementById('searchSuggestionsDropdown');

  if (!searchInput || !dropdown) return;

  let debounceTimer = null;
  let activeIndex = -1;
  let currentItems = [];
  const queryCache = new Map();

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function closeDropdown() {
    dropdown.style.display = 'none';
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    currentItems = [];
  }

  // Expose for navbar PJAX navigation and form submissions
  window.closeSearchSuggestions = closeDropdown;

  function openDropdown() {
    dropdown.style.display = 'block';
    searchInput.setAttribute('aria-expanded', 'true');
  }

  function updateSelection(newIndex) {
    currentItems.forEach((el, idx) => {
      if (idx === newIndex) {
        el.classList.add('is-selected');
        el.setAttribute('aria-selected', 'true');
        el.scrollIntoView({ block: 'nearest' });
        if (el.id) {
          searchInput.setAttribute('aria-activedescendant', el.id);
        }
      } else {
        el.classList.remove('is-selected');
        el.setAttribute('aria-selected', 'false');
      }
    });
    activeIndex = newIndex;
  }

  function handleSelect(item) {
    if (!item) return;
    const itemType = item.getAttribute('data-type');

    if (itemType === 'song') {
      const audioUrl = item.getAttribute('data-audio');
      if (audioUrl) {
        const trackData = {
          id: item.getAttribute('data-id') || '',
          audio: audioUrl,
          title: item.getAttribute('data-title') || 'Song',
          artist: item.getAttribute('data-artist') || 'Artist',
          cover: item.getAttribute('data-cover') || '',
          album: item.getAttribute('data-album') || ''
        };
        if (typeof window.playSongTrack === 'function') {
          window.playSongTrack(trackData);
        }
      }
      closeDropdown();
    } else if (itemType === 'artist' || itemType === 'album') {
      const url = item.getAttribute('data-url');
      if (url && url !== '#') {
        if (typeof window.navigateToUrl === 'function') {
          window.navigateToUrl(url);
        } else {
          window.location.href = url;
        }
      }
      closeDropdown();
    }
  }

  function renderSuggestions(data) {
    const { query, songs = [], artists = [], albums = [], total_count = 0 } = data;

    if (total_count === 0) {
      dropdown.innerHTML = `
        <div class="suggestion-empty">
          <p class="suggestion-empty-text">No matches found for "<strong>${escapeHtml(query)}</strong>"</p>
          <a href="/search/?q=${encodeURIComponent(query)}" class="suggestion-empty-link">Search full library &rarr;</a>
        </div>
      `;
      currentItems = [];
      activeIndex = -1;
      openDropdown();
      return;
    }

    let html = '';
    let itemIndex = 0;

    // 1. Songs Section
    if (songs.length > 0) {
      html += `
        <div class="suggestion-group">
          <div class="suggestion-group-title">
            <span>Songs</span>
            <span class="suggestion-group-count">${songs.length}</span>
          </div>
      `;
      songs.forEach(song => {
        const itemId = `searchSuggestion_${itemIndex++}`;
        html += `
          <div class="suggestion-item"
               id="${itemId}"
               data-type="song"
               data-id="${song.id}"
               data-audio="${escapeHtml(song.audio_url)}"
               data-title="${escapeHtml(song.title)}"
               data-artist="${escapeHtml(song.artist_name)}"
               data-cover="${escapeHtml(song.image_url)}"
               data-album="${escapeHtml(song.album_title)}"
               role="option"
               aria-selected="false"
               tabindex="-1">
            <div class="suggestion-thumb-wrap">
              <img src="${escapeHtml(song.image_url)}" alt="${escapeHtml(song.title)}" class="suggestion-thumb song-thumb" loading="lazy">
              <div class="suggestion-play-overlay">
                <svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
              </div>
            </div>
            <div class="suggestion-info">
              <div class="suggestion-title">${escapeHtml(song.title)}</div>
              <div class="suggestion-sub">${escapeHtml(song.artist_name)}${song.album_title ? ' &bull; ' + escapeHtml(song.album_title) : ''}</div>
            </div>
            <span class="suggestion-badge badge-song">Song</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    // 2. Artists Section
    if (artists.length > 0) {
      html += `
        <div class="suggestion-group">
          <div class="suggestion-group-title">
            <span>Artists</span>
            <span class="suggestion-group-count">${artists.length}</span>
          </div>
      `;
      artists.forEach(artist => {
        const itemId = `searchSuggestion_${itemIndex++}`;
        html += `
          <div class="suggestion-item"
               id="${itemId}"
               data-type="artist"
               data-id="${artist.id}"
               data-url="${escapeHtml(artist.url)}"
               role="option"
               aria-selected="false"
               tabindex="-1">
            <div class="suggestion-thumb-wrap artist-avatar">
              <img src="${escapeHtml(artist.image_url)}" alt="${escapeHtml(artist.name)}" class="suggestion-thumb artist-thumb" loading="lazy">
            </div>
            <div class="suggestion-info">
              <div class="suggestion-title">${escapeHtml(artist.name)}</div>
              <div class="suggestion-sub">${escapeHtml(artist.subtitle || 'Artist')}</div>
            </div>
            <span class="suggestion-badge badge-artist">Artist</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    // 3. Albums Section
    if (albums.length > 0) {
      html += `
        <div class="suggestion-group">
          <div class="suggestion-group-title">
            <span>Albums</span>
            <span class="suggestion-group-count">${albums.length}</span>
          </div>
      `;
      albums.forEach(album => {
        const itemId = `searchSuggestion_${itemIndex++}`;
        html += `
          <div class="suggestion-item"
               id="${itemId}"
               data-type="album"
               data-id="${album.id}"
               data-url="${escapeHtml(album.url)}"
               role="option"
               aria-selected="false"
               tabindex="-1">
            <div class="suggestion-thumb-wrap">
              <img src="${escapeHtml(album.image_url)}" alt="${escapeHtml(album.title)}" class="suggestion-thumb album-thumb" loading="lazy">
            </div>
            <div class="suggestion-info">
              <div class="suggestion-title">${escapeHtml(album.title)}</div>
              <div class="suggestion-sub">${escapeHtml(album.artist_name)}</div>
            </div>
            <span class="suggestion-badge badge-album">Album</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    // Footer with "See all results"
    html += `
      <div class="suggestion-footer">
        <a href="/search/?q=${encodeURIComponent(query)}" class="suggestion-view-all">
          <span>See all results for "<strong>${escapeHtml(query)}</strong>"</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </a>
      </div>
      <div class="suggestion-hint-bar">
        <span><kbd>&uarr;</kbd> <kbd>&darr;</kbd> navigate</span>
        <span><kbd>&crarr;</kbd> select</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    `;

    dropdown.innerHTML = html;
    currentItems = Array.from(dropdown.querySelectorAll('.suggestion-item'));
    activeIndex = -1;

    // Attach click listeners to suggestion items
    currentItems.forEach((item, idx) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(item);
      });

      item.addEventListener('mouseenter', () => {
        updateSelection(idx);
      });
    });

    const viewAllBtn = dropdown.querySelector('.suggestion-view-all');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        closeDropdown();
      });
    }

    const emptySearchLink = dropdown.querySelector('.suggestion-empty-link');
    if (emptySearchLink) {
      emptySearchLink.addEventListener('click', () => {
        closeDropdown();
      });
    }

    openDropdown();
  }

  function fetchSuggestions(query) {
    if (!query) {
      closeDropdown();
      return;
    }

    if (queryCache.has(query)) {
      renderSuggestions(queryCache.get(query));
      return;
    }

    // Show lightweight loader if query takes > 80ms
    const loaderTimeout = setTimeout(() => {
      dropdown.innerHTML = `
        <div class="suggestion-loading">
          <div class="suggestion-spinner"></div>
          <span>Searching Haven...</span>
        </div>
      `;
      openDropdown();
    }, 80);

    fetch(`/search/suggestions/?q=${encodeURIComponent(query)}`)
      .then(res => {
        clearTimeout(loaderTimeout);
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        clearTimeout(loaderTimeout);
        queryCache.set(query, data);
        if (searchInput.value.trim().toLowerCase() === query.toLowerCase()) {
          renderSuggestions(data);
        }
      })
      .catch(err => {
        clearTimeout(loaderTimeout);
        console.warn('Failed to fetch search suggestions:', err);
      });
  }

  // Input event with 200ms debounce
  searchInput.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const q = searchInput.value.trim();

    if (!q) {
      closeDropdown();
      return;
    }

    debounceTimer = setTimeout(() => {
      fetchSuggestions(q);
    }, 200);
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    const isDropdownVisible = dropdown.style.display !== 'none';

    if (e.key === 'ArrowDown') {
      if (!isDropdownVisible && searchInput.value.trim()) {
        fetchSuggestions(searchInput.value.trim());
        e.preventDefault();
        return;
      }
      if (isDropdownVisible && currentItems.length > 0) {
        e.preventDefault();
        const nextIndex = activeIndex < currentItems.length - 1 ? activeIndex + 1 : 0;
        updateSelection(nextIndex);
      }
    } else if (e.key === 'ArrowUp') {
      if (isDropdownVisible && currentItems.length > 0) {
        e.preventDefault();
        const prevIndex = activeIndex > 0 ? activeIndex - 1 : currentItems.length - 1;
        updateSelection(prevIndex);
      }
    } else if (e.key === 'Enter') {
      if (isDropdownVisible && activeIndex >= 0 && activeIndex < currentItems.length) {
        e.preventDefault();
        handleSelect(currentItems[activeIndex]);
      }
      // If no suggestion is highlighted, allow natural form submission to /search/
    } else if (e.key === 'Escape') {
      if (isDropdownVisible) {
        e.preventDefault();
        closeDropdown();
      }
    }
  });

  // Re-open if user clicks back into search input with existing text
  searchInput.addEventListener('focus', () => {
    const q = searchInput.value.trim();
    if (q && dropdown.style.display === 'none') {
      fetchSuggestions(q);
    }
  });

  // Click outside listener to dismiss dropdown
  document.addEventListener('click', (e) => {
    if (!searchForm.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  });
}

/**
 * Like / Unlike song button interactions
 * Connects .song-like-btn to /song/<id>/like/
 * - Prevents bubbling to song row playback
 * - Shows auth prompt for unauthenticated users
 * - Asynchronously toggles like state via POST with CSRF
 * - Updates button state, aria-label, and title
 */
function initLikeButtons() {
  const likeButtons = document.querySelectorAll('.song-like-btn:not([data-like-bound])');
  if (!likeButtons.length) return;

  function getCsrfToken() {
    const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input && input.value) return input.value;
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1] : '';
  }

  likeButtons.forEach(btn => {
    btn.setAttribute('data-like-bound', 'true');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isAuthenticated = btn.getAttribute('data-authenticated') === 'true' ||
                              !!document.querySelector('.user-profile-badge');

      if (!isAuthenticated) {
        if (typeof window.openAuthPrompt === 'function') {
          window.openAuthPrompt(
            'Sign in to Like Songs',
            'Create a free Haven account or sign in to save your favorite songs.'
          );
        }
        return;
      }

      const songId = btn.getAttribute('data-song-id');
      const songTitle = btn.getAttribute('data-song-title') || 'Song';
      if (!songId) return;

      // Prevent duplicate clicks while in-flight
      if (btn.disabled) return;
      btn.disabled = true;

      const csrfToken = getCsrfToken();

      fetch(`/song/${songId}/like/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      .then(response => {
        if (response.status === 401) {
          if (typeof window.openAuthPrompt === 'function') {
            window.openAuthPrompt(
              'Sign in to Like Songs',
              'Create a free Haven account or sign in to save your favorite songs.'
            );
          }
          return null;
        }
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        btn.disabled = false;
        if (!data) return;

        if (data.liked) {
          btn.classList.add('liked', 'animating');
          btn.setAttribute('aria-label', `Unlike ${songTitle}`);
          btn.setAttribute('title', `Unlike ${songTitle}`);
          setTimeout(() => btn.classList.remove('animating'), 350);
        } else {
          btn.classList.remove('liked', 'animating');
          btn.setAttribute('aria-label', `Like ${songTitle}`);
          btn.setAttribute('title', `Like ${songTitle}`);

          // If currently on the Liked Songs page, smoothly remove the track row and update counters
          const likedSection = document.getElementById('likedSongsSection');
          const songItem = btn.closest('.song-list-item');
          if (likedSection && songItem) {
            songItem.classList.add('removing');
            setTimeout(() => {
              songItem.remove();

              const remainingItems = document.querySelectorAll('#likedSongsList .song-list-item:not(.removing)');
              const count = remainingItems.length;

              // Re-index remaining track numbers and play buttons
              remainingItems.forEach((item, idx) => {
                const numEl = item.querySelector('.song-number');
                if (numEl) numEl.textContent = idx + 1;
                const playBtn = item.querySelector('.song-play-btn');
                if (playBtn) playBtn.setAttribute('data-index', idx);
              });

              // Update counter in hero
              const countText = document.getElementById('likedSongsCountText');
              if (countText) {
                countText.textContent = `${count} song${count !== 1 ? 's' : ''}`;
              }

              // Update badge in section header
              const badge = document.getElementById('likedSongsBadge');
              if (badge) {
                badge.textContent = `${count} Track${count !== 1 ? 's' : ''}`;
              }

              // If count is 0, hide actions/badge and show empty state
              if (count === 0) {
                if (badge) badge.style.display = 'none';
                const heroActions = document.getElementById('likedHeroActions');
                if (heroActions) heroActions.style.display = 'none';
                const emptyState = document.getElementById('likedSongsEmptyState');
                if (emptyState) {
                  emptyState.style.display = 'flex';
                }
              }
            }, 350);
          }
        }
      })
      .catch(err => {
        btn.disabled = false;
        console.warn('Failed to toggle like:', err);
      });
    });

    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
  });
}

/**
 * Follow / Unfollow Artists interaction
 * Connects .artist-follow-btn to explicit /artist/<id>/follow/ or /artist/<id>/unfollow/ POST endpoints
 * - Prompts unauthenticated users to log in
 * - Explicit POST endpoints prevent accidental toggle inversions on retry
 * - Synchronizes follow buttons and follower counts across the DOM
 * - Shows toast feedback
 * - Gracefully animates removal if unfollowed from /followed-artists/
 */
function initFollowButtons() {
  const followButtons = document.querySelectorAll('.artist-follow-btn:not([data-follow-bound])');
  if (!followButtons.length) return;

  function getCsrfToken() {
    const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input && input.value) return input.value;
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1] : '';
  }

  followButtons.forEach(btn => {
    btn.setAttribute('data-follow-bound', 'true');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isUserAuthenticated()) {
        if (typeof window.openAuthPrompt === 'function') {
          window.openAuthPrompt(
            'Follow Artists',
            'Sign in or create a Haven account to follow your favorite artists and view them in your collection.'
          );
        } else {
          window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
        return;
      }

      const artistId = btn.getAttribute('data-artist-id');
      const artistName = btn.getAttribute('data-artist-name') || 'Artist';
      if (!artistId || btn.disabled) return;

      const isCurrentlyFollowing = btn.classList.contains('following');
      const endpoint = isCurrentlyFollowing ? `/artist/${artistId}/unfollow/` : `/artist/${artistId}/follow/`;

      btn.disabled = true;

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      .then(res => {
        btn.disabled = false;
        if (!res.ok) {
          if (res.status === 401) {
            if (typeof window.openAuthPrompt === 'function') {
              window.openAuthPrompt('Follow Artists', 'Sign in to follow artists.');
            }
            return null;
          }
          throw new Error('Action failed');
        }
        return res.json();
      })
      .then(data => {
        if (!data || !data.success) return;

        const newFollowingState = data.followed;

        // Sync all buttons for this artist on the current page
        document.querySelectorAll(`.artist-follow-btn[data-artist-id="${artistId}"]`).forEach(b => {
          b.setAttribute('aria-pressed', newFollowingState ? 'true' : 'false');
          b.setAttribute('aria-label', newFollowingState ? `Unfollow ${artistName}` : `Follow ${artistName}`);

          const iconSpan = b.querySelector('.follow-icon');
          const textSpan = b.querySelector('.follow-text');

          if (newFollowingState) {
            b.classList.add('following');
            if (iconSpan) {
              iconSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            }
            if (textSpan) textSpan.textContent = 'Following';
          } else {
            b.classList.remove('following');
            if (iconSpan) {
              iconSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
            }
            if (textSpan) textSpan.textContent = 'Follow';
          }
        });

        // Update live follower count on artist detail page if element exists
        const countEl = document.getElementById('artistFollowerCount');
        if (countEl && typeof data.follower_count === 'number') {
          countEl.textContent = `${data.follower_count} Follower${data.follower_count !== 1 ? 's' : ''}`;
        }

        // Show feedback toast
        if (typeof window.showPlaylistToast === 'function') {
          window.showPlaylistToast('success', data.message || (newFollowingState ? `Following ${artistName}` : `Unfollowed ${artistName}`));
        }

        // If on the /followed-artists/ page and unfollowing
        if (!newFollowingState) {
          const card = document.getElementById(`followedArtistCard_${artistId}`);
          if (card) {
            card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.92)';
            setTimeout(() => {
              card.remove();
              const remainingCards = document.querySelectorAll('#followedArtistsGrid .discover-artist-card');
              const badge = document.getElementById('followedCountBadge');
              if (badge) {
                badge.textContent = `${remainingCards.length} Artist${remainingCards.length !== 1 ? 's' : ''}`;
              }
              if (remainingCards.length === 0) {
                const group = document.getElementById('followedArtistsGroup');
                const empty = document.getElementById('followedArtistsEmptyState');
                if (group) group.style.display = 'none';
                if (empty) empty.style.display = 'block';
              }
            }, 250);
          }
        }
      })
      .catch(err => {
        btn.disabled = false;
        console.warn('Follow error:', err);
        if (typeof window.showPlaylistToast === 'function') {
          window.showPlaylistToast('error', 'Network error. Please try again.');
        }
      });
    });

    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
  });
}
window.initFollowButtons = initFollowButtons;

/**
 * Playlist Song Controls: Add to Playlist Modal & Remove from Playlist
 */
function initPlaylistSongControls() {
  function getCsrfToken() {
    const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input && input.value) return input.value;
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1] : '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Toast notification helper
  function showPlaylistToast(type, message) {
    let container = document.getElementById('playlistToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'playlistToastContainer';
      container.className = 'playlist-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `playlist-toast toast-${type}`;
    const iconSvg = type === 'success'
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : (type === 'error'
          ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
          : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="8"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`);

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  window.showPlaylistToast = showPlaylistToast;

  // Modal elements
  const modalOverlay = document.getElementById('addToPlaylistModalOverlay');
  const modalCloseBtn = document.getElementById('playlistModalCloseBtn');
  const modalSongTitle = document.getElementById('playlistModalSongTitle');
  const modalLoading = document.getElementById('playlistModalLoading');
  const modalList = document.getElementById('playlistModalList');
  const modalEmpty = document.getElementById('playlistModalEmpty');

  let currentModalSongId = null;

  function closeModal() {
    if (modalOverlay) {
      modalOverlay.style.display = 'none';
      modalOverlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    }
    currentModalSongId = null;
    if (modalOverlay) {
      const createLinks = modalOverlay.querySelectorAll('.modal-create-playlist-btn, .playlist-modal-create-link, #playlistModalNewLink');
      createLinks.forEach(link => {
        link.setAttribute('href', '/playlists/create/');
      });
    }
  }

  function openModal(songId, songTitle) {
    if (!modalOverlay) return;
    currentModalSongId = songId || null;

    // Dynamically update Create New Playlist links in the modal to preserve the selected song ID
    const createLinks = modalOverlay.querySelectorAll('.modal-create-playlist-btn, .playlist-modal-create-link, #playlistModalNewLink');
    createLinks.forEach(link => {
      if (songId) {
        link.setAttribute('href', `/playlists/create/?song_id=${encodeURIComponent(songId)}`);
      } else {
        link.setAttribute('href', '/playlists/create/');
      }
    });

    if (modalSongTitle) modalSongTitle.textContent = songTitle || 'Song';
    modalOverlay.style.display = 'flex';
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    if (modalLoading) modalLoading.style.display = 'flex';
    if (modalList) { modalList.style.display = 'none'; modalList.innerHTML = ''; }
    if (modalEmpty) modalEmpty.style.display = 'none';

    fetch(`/api/user-playlists/?song_id=${encodeURIComponent(songId)}`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => {
      if (res.status === 401) {
        closeModal();
        if (typeof window.openAuthPrompt === 'function') {
          window.openAuthPrompt('Sign in to manage Playlists', 'Create a free Haven account or sign in to save songs to your personal playlists.');
        }
        return null;
      }
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!data) return;
      if (modalLoading) modalLoading.style.display = 'none';

      if (!data.playlists || !data.playlists.length) {
        if (modalEmpty) modalEmpty.style.display = 'flex';
        return;
      }

      if (modalList) {
        modalList.innerHTML = data.playlists.map(pl => `
          <div class="playlist-modal-item ${pl.has_song ? 'already-has' : ''}" data-playlist-id="${pl.id}">
            <img src="${pl.cover_url}" alt="${escapeHtml(pl.name)}" class="playlist-modal-item-thumb" />
            <div class="playlist-modal-item-info">
              <span class="playlist-modal-item-name" title="${escapeHtml(pl.name)}">${escapeHtml(pl.name)}</span>
              <span class="playlist-modal-item-meta" id="modalPlaylistMeta_${pl.id}">${pl.song_count} track${pl.song_count !== 1 ? 's' : ''}</span>
            </div>
            <button type="button" class="btn btn-sm playlist-modal-add-btn ${pl.has_song ? 'btn-added' : 'btn-primary'}"
                    data-playlist-id="${pl.id}"
                    data-playlist-name="${escapeHtml(pl.name)}"
                    data-song-id="${songId}"
                    data-song-title="${escapeHtml(songTitle)}"
                    ${pl.has_song ? 'disabled' : ''}>
              ${pl.has_song ? '<span>Added ✓</span>' : '<span>+ Add</span>'}
            </button>
          </div>
        `).join('');
        modalList.style.display = 'flex';

        // Bind clicks on modal add buttons
        modalList.querySelectorAll('.playlist-modal-add-btn:not([disabled])').forEach(addBtn => {
          addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const plId = addBtn.getAttribute('data-playlist-id');
            const sId = addBtn.getAttribute('data-song-id');
            const plName = addBtn.getAttribute('data-playlist-name') || 'Playlist';
            const sTitle = addBtn.getAttribute('data-song-title') || 'Song';

            if (!plId || !sId || addBtn.disabled) return;
            addBtn.disabled = true;
            addBtn.textContent = 'Adding...';

            const csrf = getCsrfToken();
            fetch(`/playlist/${plId}/add/${sId}/`, {
              method: 'POST',
              headers: {
                'X-CSRFToken': csrf,
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              }
            })
            .then(r => r.json())
            .then(resData => {
              if (resData.success) {
                addBtn.className = 'btn btn-sm playlist-modal-add-btn btn-added';
                addBtn.innerHTML = '<span>Added ✓</span>';
                addBtn.disabled = true;
                const metaEl = document.getElementById(`modalPlaylistMeta_${plId}`);
                if (metaEl && typeof resData.song_count === 'number') {
                  metaEl.textContent = `${resData.song_count} track${resData.song_count !== 1 ? 's' : ''}`;
                }
                showPlaylistToast('success', resData.message || `Added to "${plName}"`);
              } else if (resData.already_exists) {
                addBtn.className = 'btn btn-sm playlist-modal-add-btn btn-added';
                addBtn.innerHTML = '<span>Added ✓</span>';
                addBtn.disabled = true;
                showPlaylistToast('info', resData.message);
              } else {
                addBtn.disabled = false;
                addBtn.className = 'btn btn-sm playlist-modal-add-btn btn-primary';
                addBtn.innerHTML = '<span>+ Add</span>';
                showPlaylistToast('error', resData.error || 'Could not add song.');
              }
            })
            .catch(err => {
              addBtn.disabled = false;
              addBtn.className = 'btn btn-sm playlist-modal-add-btn btn-primary';
              addBtn.innerHTML = '<span>+ Add</span>';
              showPlaylistToast('error', 'Network error. Please try again.');
            });
          });
        });
      }
    })
    .catch(err => {
      if (modalLoading) modalLoading.style.display = 'none';
      showPlaylistToast('error', 'Failed to load playlists.');
    });
  }

  // Modal close handlers (bind only once)
  if (modalCloseBtn && !modalCloseBtn.hasAttribute('data-bound')) {
    modalCloseBtn.setAttribute('data-bound', 'true');
    modalCloseBtn.addEventListener('click', closeModal);
  }
  if (modalOverlay && !modalOverlay.hasAttribute('data-bound')) {
    modalOverlay.setAttribute('data-bound', 'true');
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay.style.display !== 'none') {
        closeModal();
      }
    });
  }

  // Bind Create New Playlist controls inside Add to Playlist modal
  const modalCreateLinks = document.querySelectorAll(
    '#addToPlaylistModalOverlay .modal-create-playlist-btn, #addToPlaylistModalOverlay .playlist-modal-create-link, #playlistModalNewLink'
  );
  modalCreateLinks.forEach(link => {
    if (!link.hasAttribute('data-modal-create-bound')) {
      link.setAttribute('data-modal-create-bound', 'true');
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Resolve destination URL with song_id query parameter
        let targetUrl = link.getAttribute('href') || '/playlists/create/';
        if (currentModalSongId && !targetUrl.includes('song_id=')) {
          const sep = targetUrl.includes('?') ? '&' : '?';
          targetUrl = `${targetUrl}${sep}song_id=${encodeURIComponent(currentModalSongId)}`;
        }

        // 2. Close and clean up the modal first
        closeModal();
        if (modalOverlay) {
          modalOverlay.style.display = 'none';
          modalOverlay.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('modal-open');

        // 3. Navigate to create playlist URL
        if (typeof window.navigateToUrl === 'function') {
          window.navigateToUrl(targetUrl, true);
        } else {
          window.location.href = targetUrl;
        }
      });
    }
  });

  // Bind Add to Playlist buttons on song rows
  const addButtons = document.querySelectorAll('.song-add-playlist-btn:not([data-bound])');
  addButtons.forEach(btn => {
    btn.setAttribute('data-bound', 'true');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isAuth = btn.getAttribute('data-authenticated') === 'true' ||
                     !!document.querySelector('.user-profile-badge');
      if (!isAuth) {
        if (typeof window.openAuthPrompt === 'function') {
          window.openAuthPrompt(
            'Sign in to manage Playlists',
            'Create a free Haven account or sign in to build and manage your personal playlists.'
          );
        }
        return;
      }

      const songId = btn.getAttribute('data-song-id');
      const songTitle = btn.getAttribute('data-song-title') || 'Song';
      openModal(songId, songTitle);
    });

    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
  });

  // Bind Remove from Playlist buttons on playlist detail song rows
  const removeButtons = document.querySelectorAll('.song-remove-playlist-btn:not([data-bound])');
  removeButtons.forEach(btn => {
    btn.setAttribute('data-bound', 'true');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const playlistId = btn.getAttribute('data-playlist-id');
      const songId = btn.getAttribute('data-song-id');
      const songTitle = btn.getAttribute('data-song-title') || 'Song';

      if (!playlistId || !songId || btn.disabled) return;
      btn.disabled = true;

      const csrf = getCsrfToken();
      fetch(`/playlist/${playlistId}/remove/${songId}/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrf,
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        btn.disabled = false;
        if (!data || !data.success) {
          showPlaylistToast('error', data?.message || 'Could not remove track.');
          return;
        }

        showPlaylistToast('success', data.message || `Removed "${songTitle}" from playlist.`);

        // Animate row removal smoothly
        const songItem = btn.closest('.song-list-item');
        if (songItem) {
          songItem.classList.add('removing');
          setTimeout(() => {
            songItem.remove();

            const remainingItems = document.querySelectorAll('#playlistSongsList .song-list-item:not(.removing)');
            const count = remainingItems.length;

            // Re-index track numbers and play buttons
            remainingItems.forEach((item, idx) => {
              const numEl = item.querySelector('.song-number');
              if (numEl) numEl.textContent = idx + 1;
              const playBtn = item.querySelector('.song-play-btn');
              if (playBtn) playBtn.setAttribute('data-index', idx);
            });

            // Update stats in hero and header badge
            const heroStats = document.getElementById('playlistHeroStats');
            if (heroStats) {
              heroStats.textContent = `${count} song${count !== 1 ? 's' : ''}`;
            }

            const badge = document.getElementById('playlistSongsBadge');
            if (badge) {
              badge.textContent = `${count} Track${count !== 1 ? 's' : ''}`;
            }

            // If playlist is now empty, hide Play All and display empty state
            if (count === 0) {
              if (badge) badge.style.display = 'none';
              const playAllBtn = document.getElementById('playlistPlayAllBtn');
              if (playAllBtn) playAllBtn.style.display = 'none';

              const emptyState = document.getElementById('playlistEmptyState');
              if (emptyState) emptyState.style.display = 'flex';
            }

            // Synchronize in-memory player queue after track removal
            if (typeof window.syncPlayerQueue === 'function') {
              window.syncPlayerQueue();
            }
          }, 350);
        }
      })
      .catch(err => {
        btn.disabled = false;
        showPlaylistToast('error', 'Network error. Please try again.');
      });
    });

    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
  });
}

/**
 * History Track Controls: Remove individual track from Listening History
 */
function initHistorySongControls() {
  function getCsrfToken() {
    const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input && input.value) return input.value;
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1] : '';
  }

  const removeButtons = document.querySelectorAll('.song-remove-history-btn:not([data-bound])');
  removeButtons.forEach(btn => {
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const songId = btn.getAttribute('data-song-id');
      const songTitle = btn.getAttribute('data-song-title') || 'Song';
      if (!songId) return;

      btn.disabled = true;

      const csrf = getCsrfToken();
      fetch(`/history/remove/${songId}/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrf,
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        btn.disabled = false;
        if (!data || !data.success) {
          if (typeof window.showPlaylistToast === 'function') {
            window.showPlaylistToast('error', data?.error || data?.message || 'Could not remove song from history.');
          }
          return;
        }

        if (typeof window.showPlaylistToast === 'function') {
          window.showPlaylistToast('success', data.message || `Removed "${songTitle}" from listening history.`);
        }

        // Animate row removal smoothly
        const songItem = btn.closest('.song-list-item');
        if (songItem) {
          songItem.classList.add('removing');
          setTimeout(() => {
            songItem.remove();

            const historyList = document.getElementById('historySongsList');
            const remainingItems = historyList
              ? historyList.querySelectorAll('.song-list-item:not(.removing)')
              : document.querySelectorAll('.recently-played-page .song-list-item:not(.removing)');
            const count = remainingItems.length;

            // Re-index track numbers and play buttons
            remainingItems.forEach((item, idx) => {
              const numEl = item.querySelector('.song-number');
              if (numEl) numEl.textContent = idx + 1;
              const playBtn = item.querySelector('.song-play-btn');
              if (playBtn) playBtn.setAttribute('data-index', idx);
            });

            // Update stats in hero and header badge
            const heroStats = document.getElementById('historySongsCountText');
            if (heroStats) {
              heroStats.textContent = `${count} Track${count !== 1 ? 's' : ''}`;
            }

            const badge = document.getElementById('historySongsBadge');
            if (badge) {
              badge.textContent = `${count} Track${count !== 1 ? 's' : ''}`;
            }

            // If history is now empty, hide Play All and Clear History actions, and display empty state
            if (count === 0) {
              if (badge) badge.style.display = 'none';
              const heroActions = document.getElementById('historyHeroActions');
              if (heroActions) heroActions.style.display = 'none';

              const emptyState = document.getElementById('historyEmptyState');
              if (emptyState) emptyState.style.display = 'block';
            }

            // Synchronize in-memory player queue after track removal
            if (typeof window.syncPlayerQueue === 'function') {
              window.syncPlayerQueue();
            }
          }, 350);
        }
      })
      .catch(err => {
        btn.disabled = false;
        console.warn('Failed to remove track from history:', err);
        if (typeof window.showPlaylistToast === 'function') {
          window.showPlaylistToast('error', 'Network error. Please try again.');
        }
      });
    });

    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
  });
}
window.initHistorySongControls = initHistorySongControls;


/**
 * Step 5: Playlist Detail Management (Track Reordering & Delete Playlist Modal)
 */
function initPlaylistDetailManagement() {
  initDeletePlaylistModal();
  initPlaylistReordering();
}

/**
 * Delete Playlist Confirmation Modal Handlers
 */
function initDeletePlaylistModal() {
  const openButtons = document.querySelectorAll('.btn-open-delete-dialog, #btnOpenDeleteModal');
  const overlay = document.getElementById('deletePlaylistModalOverlay');
  const closeBtn = document.getElementById('deleteModalCloseBtn');
  const cancelBtn = document.getElementById('btnCancelDeletePlaylist');
  const form = document.getElementById('deletePlaylistForm');

  if (!overlay) return;

  function openModal() {
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      overlay.setAttribute('aria-hidden', 'false');
    });
    cancelBtn?.focus();
  }

  function closeModal() {
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!overlay.classList.contains('visible')) {
        overlay.style.display = 'none';
      }
    }, 200);
  }

  openButtons.forEach(btn => {
    if (!btn.hasAttribute('data-bound')) {
      btn.setAttribute('data-bound', 'true');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }
  });

  if (closeBtn && !closeBtn.hasAttribute('data-bound')) {
    closeBtn.setAttribute('data-bound', 'true');
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  if (cancelBtn && !cancelBtn.hasAttribute('data-bound')) {
    cancelBtn.setAttribute('data-bound', 'true');
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  if (!overlay.hasAttribute('data-bound')) {
    overlay.setAttribute('data-bound', 'true');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display !== 'none' && overlay.classList.contains('visible')) {
        closeModal();
      }
    });
  }

  if (form && !form.hasAttribute('data-bound')) {
    form.setAttribute('data-bound', 'true');
    form.addEventListener('submit', () => {
      const confirmBtn = document.getElementById('btnConfirmDeletePlaylist');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span>Deleting...</span>';
      }
    });
  }
}

/**
 * Playlist Track Drag-and-Drop & Keyboard Reordering
 */
function initPlaylistReordering() {
  const songsList = document.getElementById('playlistSongsList');
  if (!songsList) return;

  const firstItem = songsList.querySelector('.song-list-item');
  const playlistId = firstItem?.getAttribute('data-playlist-id');
  if (!playlistId) return;

  let draggedItem = null;
  let initialOrder = [];

  function getSongOrder() {
    return Array.from(songsList.querySelectorAll('.song-list-item'))
      .map(item => parseInt(item.getAttribute('data-song-id'), 10))
      .filter(id => !isNaN(id));
  }

  function reindexDom() {
    const items = songsList.querySelectorAll('.song-list-item');
    items.forEach((item, idx) => {
      const numEl = item.querySelector('.song-number');
      if (numEl) numEl.textContent = idx + 1;
      const playBtn = item.querySelector('.song-play-btn');
      if (playBtn) playBtn.setAttribute('data-index', idx);
    });
  }

  function revertOrder(savedOrder) {
    const itemsById = new Map();
    songsList.querySelectorAll('.song-list-item').forEach(item => {
      const id = parseInt(item.getAttribute('data-song-id'), 10);
      itemsById.set(id, item);
    });
    savedOrder.forEach(id => {
      const item = itemsById.get(id);
      if (item) songsList.appendChild(item);
    });
    reindexDom();
  }

  function persistOrder(newOrder, oldOrder) {
    if (JSON.stringify(newOrder) === JSON.stringify(oldOrder)) return;

    const csrf = getCsrfToken();
    fetch(`/playlist/${playlistId}/reorder/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrf,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ song_ids: newOrder })
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data && data.success) {
        reindexDom();
        if (typeof window.syncPlayerQueue === 'function') {
          window.syncPlayerQueue();
        }
        showPlaylistToast('success', 'Track order updated.');
      } else {
        revertOrder(oldOrder);
        showPlaylistToast('error', data?.error || 'Could not update track order.');
      }
    })
    .catch(err => {
      console.warn('Reorder error:', err);
      revertOrder(oldOrder);
      showPlaylistToast('error', 'Network error updating track order.');
    });
  }

  const items = songsList.querySelectorAll('.song-list-item');
  items.forEach(item => {
    const handle = item.querySelector('.song-drag-handle');
    if (!handle || handle.hasAttribute('data-drag-bound')) return;
    handle.setAttribute('data-drag-bound', 'true');

    // Enable dragging only when grabbing the handle
    handle.addEventListener('mousedown', () => {
      item.setAttribute('draggable', 'true');
    });
    handle.addEventListener('touchstart', () => {
      item.setAttribute('draggable', 'true');
    }, { passive: true });

    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      initialOrder = getSongOrder();
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.getAttribute('data-song-id'));
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      item.removeAttribute('draggable');
      songsList.querySelectorAll('.song-list-item.drop-target-above, .song-list-item.drop-target-below')
        .forEach(el => el.classList.remove('drop-target-above', 'drop-target-below'));

      if (draggedItem) {
        const finalOrder = getSongOrder();
        persistOrder(finalOrder, initialOrder);
        draggedItem = null;
      }
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedItem || draggedItem === item) return;
      e.dataTransfer.dropEffect = 'move';

      const rect = item.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        songsList.insertBefore(draggedItem, item);
      } else {
        songsList.insertBefore(draggedItem, item.nextSibling);
      }
    });

    // Keyboard accessibility for reordering (Alt + Up / Down)
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && (e.altKey || e.shiftKey)) {
        e.preventDefault();
        const prev = item.previousElementSibling;
        if (prev && prev.classList.contains('song-list-item')) {
          const oldOrder = getSongOrder();
          songsList.insertBefore(item, prev);
          const newOrder = getSongOrder();
          persistOrder(newOrder, oldOrder);
          handle.focus();
        }
      } else if (e.key === 'ArrowDown' && (e.altKey || e.shiftKey)) {
        e.preventDefault();
        const next = item.nextElementSibling;
        if (next && next.classList.contains('song-list-item')) {
          const oldOrder = getSongOrder();
          songsList.insertBefore(next, item);
          const newOrder = getSongOrder();
          persistOrder(newOrder, oldOrder);
          handle.focus();
        }
      }
    });
  });
}

/**
 * Preset Cover Selection & Custom Cover Handling for Create & Edit Playlist Forms
 */
function initPresetGallerySelection() {
  const forms = document.querySelectorAll('#createPlaylistForm, #editPlaylistForm');
  if (!forms.length) return;

  forms.forEach(form => {
    const cards = form.querySelectorAll('.preset-option-card');
    const radios = form.querySelectorAll('.preset-radio-input');

    function syncSelected() {
      radios.forEach(radio => {
        const card = radio.closest('.preset-option-card');
        if (card) {
          if (radio.checked) {
            card.classList.add('selected');
          } else {
            card.classList.remove('selected');
          }
        }
      });
    }

    // Immediately sync visual cards on initialization / PJAX rebind
    syncSelected();

    radios.forEach(radio => {
      if (!radio.hasAttribute('data-preset-bound')) {
        radio.setAttribute('data-preset-bound', 'true');
        radio.addEventListener('change', () => {
          syncSelected();
        });
      }
    });

    cards.forEach(card => {
      if (!card.hasAttribute('data-card-bound')) {
        card.setAttribute('data-card-bound', 'true');
        card.addEventListener('click', (e) => {
          const radio = card.querySelector('.preset-radio-input');
          if (radio) {
            radio.checked = true;
            syncSelected();
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
    });

    // Custom Cover File Upload & Removal Toggle
    const fileInput = form.querySelector('#customCoverInput');
    const idleState = form.querySelector('#uploaderIdleState');
    const previewState = form.querySelector('#uploaderPreviewState');
    const previewImg = form.querySelector('#uploaderPreviewImg');
    const fileNameSpan = form.querySelector('#uploaderFileName');
    const clearBtn = form.querySelector('#btnClearCustomCover');
    const removeCheck = form.querySelector('#removeCustomCoverCheck');
    const existingCard = form.querySelector('#existingCoverCard');

    if (fileInput && !fileInput.hasAttribute('data-file-bound')) {
      fileInput.setAttribute('data-file-bound', 'true');
      fileInput.addEventListener('change', function(e) {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(evt) {
            if (previewImg) previewImg.src = evt.target.result;
            if (fileNameSpan) fileNameSpan.textContent = file.name;
            if (idleState) idleState.style.display = 'none';
            if (previewState) previewState.style.display = 'flex';
            if (removeCheck) {
              removeCheck.checked = false;
              existingCard?.classList.remove('marked-for-removal');
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (clearBtn && fileInput && !clearBtn.hasAttribute('data-clear-bound')) {
      clearBtn.setAttribute('data-clear-bound', 'true');
      clearBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        fileInput.value = '';
        if (previewImg) previewImg.src = '';
        if (previewState) previewState.style.display = 'none';
        if (idleState) idleState.style.display = 'flex';
      });
    }

    if (removeCheck && existingCard && !removeCheck.hasAttribute('data-remove-bound')) {
      removeCheck.setAttribute('data-remove-bound', 'true');
      removeCheck.addEventListener('change', function() {
        if (this.checked) {
          existingCard.classList.add('marked-for-removal');
          if (fileInput) fileInput.value = '';
          if (previewState) previewState.style.display = 'none';
          if (idleState) idleState.style.display = 'flex';
        } else {
          existingCard.classList.remove('marked-for-removal');
        }
      });
    }
  });
}
window.initPresetGallerySelection = initPresetGallerySelection;

/**
 * Rebind page interactions when content is swapped via PJAX
 */
function rebindPageInteractions() {
  initNavbarScrollSpy();
  initAuthModal();
  initPasswordToggles();
  initSignupValidation();
  initLockedItems();
  initViewAllAlbums();
  initViewAllArtists();
  initLikeButtons();
  initFollowButtons();
  initPlaylistSongControls();
  initHistorySongControls();
  initPlaylistDetailManagement();
  initPresetGallerySelection();
  if (typeof window.closeProfileDropdown === 'function') {
    window.closeProfileDropdown(false);
  }
  initProfileDropdown();
  initProfileAvatarCustomization();
  if (typeof window.rebindSongItems === 'function') {
    window.rebindSongItems();
  }
}

/**
 * Persistent Client-Side Navigation (PJAX)
 * Preserves the single HTML5 Audio playback instance across page navigations.
 * Swaps <main id="mainContent"> dynamically, updates page title and browser history,
 * and rebinds interactive components without interrupting audio.
 */
function initPersistentNavigation() {
  // Create top progress bar element if not already present
  let progressBar = document.getElementById('pjaxProgressBar');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.id = 'pjaxProgressBar';
    progressBar.className = 'pjax-progress-bar';
    document.body.appendChild(progressBar);
  }

  function startProgress() {
    progressBar.style.transition = 'width 0.25s ease, opacity 0.15s ease';
    progressBar.style.width = '35%';
    progressBar.style.opacity = '1';
  }

  function completeProgress() {
    progressBar.style.width = '100%';
    setTimeout(() => {
      progressBar.style.opacity = '0';
      setTimeout(() => {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
      }, 200);
    }, 120);
  }

  function failProgress() {
    progressBar.style.opacity = '0';
    setTimeout(() => {
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
    }, 200);
  }

  function updateNavbarLinks(targetUrl) {
    const urlObj = new URL(targetUrl, window.location.origin);
    const pathname = urlObj.pathname;
    const isHome = (pathname === '/' || pathname === '');

    const navLinks = document.querySelectorAll('.nav-center .nav-link');
    navLinks.forEach(link => {
      const section = link.getAttribute('data-section');
      if (!section) return;

      if (section === 'hero') {
        link.href = '/';
        if (isHome) link.classList.add('active');
        else link.classList.remove('active');
      } else if (section === 'discover') {
        link.href = '/discover/';
        if (pathname.startsWith('/discover/')) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      } else if (section === 'following') {
        link.href = '/followed-artists/';
        if (pathname.startsWith('/followed-artists/')) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      } else if (section === 'playlists') {
        link.href = '/playlists/';
        if (pathname.startsWith('/playlists/') || pathname.startsWith('/playlist/')) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      } else if (section === 'history') {
        link.href = '/recently-played/';
        if (pathname.startsWith('/recently-played/') || pathname.startsWith('/history/')) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      } else {
        link.href = isHome ? `#${section}` : `/#${section}`;
        if (!isHome) {
          if (section === 'popular-albums' && pathname.startsWith('/album/')) {
            link.classList.add('active');
          } else if (section === 'featured-artists' && pathname.startsWith('/artist/')) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        }
      }
    });

    // Sync search input if navigating to/from search
    const searchInput = document.getElementById('navSearchInput');
    if (searchInput) {
      if (pathname.startsWith('/search/')) {
        const q = urlObj.searchParams.get('q') || '';
        searchInput.value = q;
      } else {
        searchInput.value = '';
      }
    }
  }

  function navigate(url, shouldPushState = true) {
    // 1. Immediately dismiss any open modal overlays
    const openModals = document.querySelectorAll(
      '#addToPlaylistModalOverlay, #deletePlaylistModalOverlay, #authModalOverlay, .playlist-modal-overlay, .modal-overlay'
    );
    openModals.forEach(m => {
      m.style.display = 'none';
      m.setAttribute('aria-hidden', 'true');
      m.classList.remove('visible');
    });
    document.body.classList.remove('modal-open');

    // 2. Dismiss search autocomplete dropdown
    if (typeof window.closeSearchSuggestions === 'function') {
      window.closeSearchSuggestions();
    } else {
      const searchDropdown = document.getElementById('searchSuggestionsDropdown');
      const searchInputEl = document.getElementById('navSearchInput');
      if (searchDropdown) searchDropdown.style.display = 'none';
      if (searchInputEl) {
        searchInputEl.setAttribute('aria-expanded', 'false');
        searchInputEl.removeAttribute('aria-activedescendant');
      }
    }

    const targetUrl = new URL(url, window.location.origin);
    const currentUrl = new URL(window.location.href);

    // If same page with just a hash change
    if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
      if (targetUrl.hash) {
        const el = document.querySelector(targetUrl.hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          if (shouldPushState) {
            window.history.pushState({ pjax: true, url: targetUrl.href }, document.title, targetUrl.href);
          }
          return;
        }
      }
    }

    startProgress();

    fetch(targetUrl.href, {
      headers: {
        'X-Requested-With': 'Haven-PJAX'
      }
    })
    .then(response => {
      if (response.redirected) {
        failProgress();
        window.location.href = response.url;
        return null;
      }
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return response.text();
    })
    .then(html => {
      if (!html) return;
      completeProgress();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const newMain = doc.getElementById('mainContent');
      const currentMain = document.getElementById('mainContent');

      if (!newMain || !currentMain) {
        failProgress();
        window.location.href = targetUrl.href;
        return;
      }

      // Update document title
      if (doc.title) {
        document.title = doc.title;
      }

      // Swap main content
      currentMain.innerHTML = newMain.innerHTML;

      // Close profile dropdown on navigation
      if (typeof window.closeProfileDropdown === 'function') {
        window.closeProfileDropdown(false);
      }

      // Update browser history
      if (shouldPushState) {
        window.history.pushState({ pjax: true, url: targetUrl.href }, doc.title, targetUrl.href);
      }

      // Update navbar links and active indicators
      updateNavbarLinks(targetUrl.href);

      // Handle scroll position
      if (targetUrl.hash) {
        const targetEl = document.querySelector(targetUrl.hash);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo(0, 0);
        }
      } else {
        window.scrollTo(0, 0);
      }

      // Rebind all interactive components on the swapped page
      rebindPageInteractions();
    })
    .catch(err => {
      failProgress();
      console.warn('PJAX navigation fallback to standard load:', err);
      window.location.href = targetUrl.href;
    });
  }

  // Expose global navigate function
  window.navigateToUrl = navigate;

  // Global click interceptor for internal links
  document.addEventListener('click', (e) => {
    // Only left clicks without modifier keys
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) {
      return;
    }

    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) return;

    // Ignore links with target="_blank" or download attribute
    if (link.target === '_blank' || link.hasAttribute('download')) return;

    // Ignore external origins
    let url;
    try {
      url = new URL(link.href, window.location.origin);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;

    // Bypass PJAX for admin and auth actions
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/logout/')) {
      return;
    }

    // If on home page and clicking a hash link like #popular-albums
    if (window.location.pathname === '/' && href.startsWith('#')) {
      const el = document.querySelector(href);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState({ pjax: true, url: link.href }, document.title, link.href);
      }
      return;
    }

    e.preventDefault();
    navigate(link.href, true);
  });

  // Intercept navbar search form submission
  const navSearchForm = document.getElementById('navSearchForm');
  if (navSearchForm) {
    navSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('navSearchInput');
      const query = input ? input.value.trim() : '';
      const action = navSearchForm.getAttribute('action') || '/search/';
      const targetUrl = new URL(action, window.location.origin);
      if (query) {
        targetUrl.searchParams.set('q', query);
      }
      if (typeof window.closeSearchSuggestions === 'function') {
        window.closeSearchSuggestions();
      }
      navigate(targetUrl.href, true);
    });
  }

  // Handle browser back and forward navigation
  window.addEventListener('popstate', (e) => {
    navigate(window.location.href, false);
  });

  // Synchronize navbar link hrefs and active states on initial load
  updateNavbarLinks(window.location.href);
}
