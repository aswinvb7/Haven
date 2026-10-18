import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'MusicStreamProject.settings')

import django
django.setup()

from django.test import Client
from django.contrib.auth.models import User
from django.urls import reverse

def main():
    print("==================================================================")
    print("NAVBAR REDESIGN & PROFILE DROPDOWN VERIFICATION")
    print("==================================================================")

    c = Client(SERVER_NAME='localhost')

    # 1. Guest view
    r_guest = c.get('/')
    assert r_guest.status_code == 200
    guest_html = r_guest.content.decode()
    assert 'href="/login/"' in guest_html, "Login button missing for guest"
    assert 'href="/signup/"' in guest_html, "Signup button missing for guest"
    assert 'id="profileAvatarBtn"' not in guest_html, "Avatar should NOT be present for guest"
    assert 'id="profileDropdownMenu"' not in guest_html, "Dropdown should NOT be present for guest"
    print("[PASS] 1. Guest navbar shows Login and Sign Up, hides avatar and profile menu")

    # 2. Authenticated user view
    user, _ = User.objects.get_or_create(username='verify_user', email='verify@test.com')
    c.force_login(user)

    r_auth = c.get('/')
    assert r_auth.status_code == 200
    auth_html = r_auth.content.decode()
    assert 'id="profileAvatarBtn"' in auth_html, "Avatar button missing for auth user"
    assert 'id="profileDropdownMenu"' in auth_html, "Profile dropdown menu missing for auth user"
    assert 'aria-label="Open profile menu"' in auth_html, "Accessibility label missing on avatar"
    assert 'aria-haspopup="true"' in auth_html, "aria-haspopup missing on avatar"
    assert 'aria-expanded="false"' in auth_html, "aria-expanded should start false"
    assert 'class="user-greeting"' not in auth_html, "Greeting should be removed"
    assert 'Hi, ' not in auth_html, "Hi, username should be removed"
    assert '<a href="/logout/" class="btn btn-secondary"' not in auth_html, "Standalone logout button should be removed"
    print("[PASS] 2. Authenticated navbar shows accessible avatar, removes greeting and standalone logout")

    # 3. Main navbar History link check
    nav_center_start = auth_html.find('class="nav-center"')
    nav_center_end = auth_html.find('</nav>', nav_center_start)
    nav_center = auth_html[nav_center_start:nav_center_end]
    assert 'data-section="history"' not in nav_center, "History link should be removed from main navbar center"
    print("[PASS] 3. History link removed from main navbar center")

    # 4. Six destinations in exact order
    p_url = reverse('profile')
    h_url = reverse('recently_played')
    l_url = reverse('liked_songs')
    pl_url = reverse('playlist_list')
    f_url = reverse('followed_artists')
    lo_url = reverse('logout')

    drop_start = auth_html.find('id="profileDropdownMenu"')
    drop_html = auth_html[drop_start:]

    idx_p = drop_html.find(f'href="{p_url}"')
    idx_h = drop_html.find(f'href="{h_url}"')
    idx_l = drop_html.find(f'href="{l_url}"')
    idx_pl = drop_html.find(f'href="{pl_url}"')
    idx_f = drop_html.find(f'href="{f_url}"')
    idx_lo = drop_html.find(f'action="{lo_url}"')

    assert idx_p != -1, "My Profile missing in dropdown"
    assert idx_h != -1, "Recently Played missing in dropdown"
    assert idx_l != -1, "Liked Songs missing in dropdown"
    assert idx_pl != -1, "My Playlists missing in dropdown"
    assert idx_f != -1, "Followed Artists missing in dropdown"
    assert idx_lo != -1, "Logout missing in dropdown"

    assert idx_p < idx_h < idx_l < idx_pl < idx_f < idx_lo, "Dropdown destinations are not in exact specified order!"
    print("[PASS] 4. All six destinations present in exact required order: Profile -> History -> Likes -> Playlists -> Following -> Logout")

    # 5. Profile page accessible to authenticated user
    r_prof = c.get('/profile/')
    assert r_prof.status_code == 200
    prof_html = r_prof.content.decode()
    assert 'verify_user' in prof_html, "Username missing on profile page"
    assert 'verify@test.com' in prof_html, "Email missing on profile page"
    assert 'Haven Member' in prof_html, "Member badge missing on profile page"
    assert 'Recently Played' in prof_html, "History stat missing on profile page"
    assert 'Liked Songs' in prof_html, "Liked songs stat missing on profile page"
    assert 'Playlists' in prof_html, "Playlists stat missing on profile page"
    assert 'Followed Artists' in prof_html, "Followed artists stat missing on profile page"
    print("[PASS] 5. My Profile page renders authenticated user details and personal library stats")

    # 6. Guest access to profile page is blocked
    c.logout()
    r_prof_guest = c.get('/profile/')
    assert r_prof_guest.status_code == 302, "Guest access to /profile/ must redirect"
    assert '/login/' in r_prof_guest.get('Location')
    print("[PASS] 6. Guest access to /profile/ redirected to login")

    # 7. Secure logout flow
    c.force_login(user)
    r_logout = c.post(reverse('logout'))
    assert r_logout.status_code == 302
    assert r_logout.get('Location') == reverse('home')
    assert '_auth_user_id' not in c.session, "Session not cleared after logout"
    print("[PASS] 7. POST logout clears session and redirects to home")

    print("==================================================================")
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!")
    print("==================================================================")

if __name__ == '__main__':
    main()
