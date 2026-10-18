import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'MusicStreamProject.settings')

import django
django.setup()

from django.test import Client
from django.contrib.auth.models import User
from music.models import Song, ListeningHistory, Artist, Album

def run_tests():
    print("==================================================================")
    print("HAVEN - HISTORY PAGE & NAVIGATION VERIFICATION TESTS")
    print("==================================================================")

    c = Client(SERVER_NAME='localhost')

    # Test 1: Unauthenticated GET /recently-played/
    r1 = c.get('/recently-played/')
    assert r1.status_code == 302, f"Expected 302, got {r1.status_code}"
    assert '/login/?next=/recently-played/' in r1.get('Location'), f"Unexpected redirect: {r1.get('Location')}"
    print("[PASS] 1. Unauthenticated /recently-played/ redirects to /login/?next=/recently-played/")

    # Test 2: Unauthenticated GET /history/
    r2 = c.get('/history/')
    assert r2.status_code == 302, f"Expected 302, got {r2.status_code}"
    assert '/login/?next=/history/' in r2.get('Location'), f"Unexpected redirect: {r2.get('Location')}"
    print("[PASS] 2. Unauthenticated /history/ redirects to /login/?next=/history/")

    # Test 3: Login preserves next parameter
    test_user, created = User.objects.get_or_create(username='history_nav_test_user')
    test_user.set_password('Password123!')
    test_user.save()

    r3 = c.post('/login/', {'username': 'history_nav_test_user', 'password': 'Password123!', 'next': '/recently-played/'})
    assert r3.status_code == 302, f"Expected 302 on login, got {r3.status_code}"
    assert r3.get('Location') == '/recently-played/', f"Expected redirect to /recently-played/, got {r3.get('Location')}"
    print("[PASS] 3. Login preserves next parameter and redirects to /recently-played/")

    r3b = c.post('/login/', {'username': 'history_nav_test_user', 'password': 'Password123!', 'next': '/history/'})
    assert r3b.status_code == 302, f"Expected 302 on login, got {r3b.status_code}"
    assert r3b.get('Location') == '/history/', f"Expected redirect to /history/, got {r3b.get('Location')}"
    print("[PASS] 4. Login preserves next parameter and redirects to /history/")

    # Force login for authenticated user tests
    c.force_login(test_user)

    # Test 5: Authenticated GET /recently-played/
    r4 = c.get('/recently-played/')
    assert r4.status_code == 200, f"Expected 200, got {r4.status_code}"
    content4 = r4.content.decode('utf-8')
    assert 'id="mainContent"' in content4, "Missing #mainContent container"
    assert 'Recently Played' in content4, "Missing 'Recently Played' text"
    assert '<title>Recently Played - Haven</title>' in content4, "Page title mismatch"
    print("[PASS] 5. Authenticated GET /recently-played/ renders 200 with #mainContent and title")

    # Test 6: Authenticated GET /history/
    r5 = c.get('/history/')
    assert r5.status_code == 200, f"Expected 200, got {r5.status_code}"
    content5 = r5.content.decode('utf-8')
    assert 'id="mainContent"' in content5, "Missing #mainContent container on /history/"
    assert '<title>Recently Played - Haven</title>' in content5, "Page title mismatch on /history/"
    print("[PASS] 6. Authenticated GET /history/ resolves and renders 200 with #mainContent")

    # Test 7: PJAX request to /recently-played/
    r6 = c.get('/recently-played/', HTTP_X_REQUESTED_WITH='Haven-PJAX')
    assert r6.status_code == 200, f"Expected 200, got {r6.status_code}"
    content6 = r6.content.decode('utf-8')
    assert 'id="mainContent"' in content6, "PJAX response missing #mainContent"
    assert 'recently-played-page' in content6, "PJAX response missing recently-played-page"
    print("[PASS] 7. PJAX request to /recently-played/ succeeds with full swappable #mainContent")

    # Test 8: Empty state test
    ListeningHistory.objects.filter(user=test_user).delete()
    r7 = c.get('/recently-played/')
    content7 = r7.content.decode('utf-8')
    assert 'history-empty-state' in content7, "Empty state container missing when history empty"
    assert 'No Listening History Yet' in content7, "Empty state headline missing"
    print("[PASS] 8. Empty history state displays friendly empty state")

    # Test 9: Populated history state
    song = Song.objects.first()
    if song:
        ListeningHistory.objects.create(user=test_user, song=song)
        r8 = c.get('/recently-played/')
        content8 = r8.content.decode('utf-8')
        assert song.title in content8, f"Song title '{song.title}' missing from history list"
        assert 'data-song-id=' in content8, "Song item missing data-song-id attribute"
        assert 'Clear History' in content8, "Clear History button missing when songs present"
        print(f"[PASS] 9. Populated history correctly renders song '{song.title}' and playback elements")

    # Clean up test user
    ListeningHistory.objects.filter(user=test_user).delete()
    test_user.delete()

    print("==================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================================")

if __name__ == '__main__':
    run_tests()
