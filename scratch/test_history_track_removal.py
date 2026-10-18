import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'MusicStreamProject.settings')

import django
django.setup()

from django.test import Client
from django.contrib.auth.models import User
from music.models import Song, Album, Artist, Playlist, PlaylistSong, Like, ListeningHistory

def run_tests():
    print("==================================================================")
    print("HAVEN - HISTORY TRACK REMOVAL & UI COMPACTNESS VERIFICATION")
    print("==================================================================")

    c = Client(SERVER_NAME='localhost')

    # Setup test users
    user1, _ = User.objects.get_or_create(username='history_test_user_1')
    user1.set_password('Password123!')
    user1.save()

    user2, _ = User.objects.get_or_create(username='history_test_user_2')
    user2.set_password('Password123!')
    user2.save()

    # Get or create test songs
    artist, _ = Artist.objects.get_or_create(name='Test Artist History')
    album, _ = Album.objects.get_or_create(title='Test Album History', artist=artist)
    song1, _ = Song.objects.get_or_create(title='Test History Song 1', artist=artist, album=album)
    song2, _ = Song.objects.get_or_create(title='Test History Song 2', artist=artist, album=album)

    # Clean existing history for test users
    ListeningHistory.objects.filter(user__in=[user1, user2]).delete()

    # 1. Guest Rejection (Unauthenticated)
    r1 = c.post(f'/history/remove/{song1.id}/')
    assert r1.status_code == 302, f"Expected 302 for unauthenticated POST, got {r1.status_code}"
    assert '/login/?next=' in r1.get('Location'), f"Expected login redirect, got {r1.get('Location')}"
    print("[PASS] 1. Unauthenticated request to /history/remove/<id>/ is rejected with redirect to login")

    r1_post = c.post('/history/remove/', {'song_id': song1.id})
    assert r1_post.status_code == 302, f"Expected 302 for unauthenticated POST to /history/remove/, got {r1_post.status_code}"
    print("[PASS] 2. Unauthenticated request to /history/remove/ is rejected with redirect to login")

    # Log in as user1
    c.force_login(user1)

    # 2. Method Validation (GET not allowed)
    r2 = c.get(f'/history/remove/{song1.id}/')
    assert r2.status_code == 405, f"Expected 405 Method Not Allowed for GET, got {r2.status_code}"
    print("[PASS] 3. GET request to /history/remove/<id>/ is rejected with 405 Method Not Allowed")

    # 3. Invalid Song ID Handling
    r3 = c.post('/history/remove/99999999/')
    assert r3.status_code == 404, f"Expected 404 for non-existent song, got {r3.status_code}"
    print("[PASS] 4. Non-existent song ID returns 404 Not Found")

    r3_bad = c.post('/history/remove/', {'song_id': 'invalid_id'}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
    assert r3_bad.status_code == 400, f"Expected 400 for invalid song_id, got {r3_bad.status_code}"
    print("[PASS] 5. Malformed song ID returns 400 Bad Request")

    # 4. History Records Setup:
    # User 1 has 3 history records for song1, and 1 record for song2
    h1_a = ListeningHistory.objects.create(user=user1, song=song1)
    h1_b = ListeningHistory.objects.create(user=user1, song=song1)
    h1_c = ListeningHistory.objects.create(user=user1, song=song1)
    h2 = ListeningHistory.objects.create(user=user1, song=song2)

    # User 2 has 2 history records for song1
    h_user2_a = ListeningHistory.objects.create(user=user2, song=song1)
    h_user2_b = ListeningHistory.objects.create(user=user2, song=song1)

    # Also add song1 to a playlist and likes for user1
    playlist = Playlist.objects.create(user=user1, name='History Isolation Test Playlist')
    playlist_song = PlaylistSong.objects.create(playlist=playlist, song=song1, order=0)
    like = Like.objects.create(user=user1, song=song1)

    # 5. Successful Removal of song1 via AJAX POST /history/remove/<id>/
    r4 = c.post(
        f'/history/remove/{song1.id}/',
        HTTP_X_REQUESTED_WITH='XMLHttpRequest'
    )
    assert r4.status_code == 200, f"Expected 200, got {r4.status_code}"
    data4 = r4.json()
    assert data4.get('success') is True, f"Expected success=True, got {data4}"
    assert data4.get('song_id') == song1.id, "Incorrect song_id in response"
    assert data4.get('deleted_count') == 3, f"Expected 3 deleted history entries, got {data4.get('deleted_count')}"
    assert data4.get('remaining_count') == 1, f"Expected 1 remaining song (song2), got {data4.get('remaining_count')}"
    print("[PASS] 6. Successful AJAX removal removes all 3 user history records for song1 and returns correct remaining count")

    # 6. Verify User1 has NO history records for song1, but STILL HAS song2
    assert ListeningHistory.objects.filter(user=user1, song=song1).count() == 0, "User1 still has history for song1!"
    assert ListeningHistory.objects.filter(user=user1, song=song2).count() == 1, "User1 history for song2 was affected!"
    print("[PASS] 7. User1 history records for song1 are completely removed, and song2 remains intact")

    # 7. Cross-User Isolation: Verify User2 still has their 2 history records for song1
    assert ListeningHistory.objects.filter(user=user2, song=song1).count() == 2, "User2 history records were modified!"
    print("[PASS] 8. Cross-user isolation verified: User2's history records are completely untouched")

    # 8. Data Preservation: Verify Song model, audio file, Playlists, and Likes are untouched
    assert Song.objects.filter(id=song1.id).exists(), "Song model was deleted!"
    assert PlaylistSong.objects.filter(id=playlist_song.id).exists(), "PlaylistSong was deleted!"
    assert Like.objects.filter(id=like.id).exists(), "Like was deleted!"
    print("[PASS] 9. Song model, playlist associations, and likes are 100% preserved")

    # 9. Test removal via alternative POST route /history/remove/ with body
    r5 = c.post(
        '/history/remove/',
        {'song_id': song2.id},
        HTTP_X_REQUESTED_WITH='XMLHttpRequest'
    )
    assert r5.status_code == 200, f"Expected 200, got {r5.status_code}"
    data5 = r5.json()
    assert data5.get('success') is True
    assert data5.get('remaining_count') == 0, f"Expected 0 remaining songs, got {data5.get('remaining_count')}"
    assert ListeningHistory.objects.filter(user=user1).count() == 0, "User1 history should now be empty"
    print("[PASS] 10. Secondary route /history/remove/ successfully removes song2 and reports remaining_count=0")

    # 10. HTML & Template Verification
    # Re-add a track for user1 to render HTML
    ListeningHistory.objects.create(user=user1, song=song1)
    r_html = c.get('/recently-played/')
    assert r_html.status_code == 200
    html_content = r_html.content.decode('utf-8')

    assert 'class="song-remove-history-btn"' in html_content, "Missing .song-remove-history-btn in HTML"
    assert f'data-song-id="{song1.id}"' in html_content, "Missing data-song-id on remove button"
    assert 'aria-label="Remove Test History Song 1 from listening history"' in html_content, "Missing aria-label on remove button"
    assert 'class="song-cover-thumb-wrapper"' in html_content, "Missing .song-cover-thumb-wrapper in HTML"
    print("[PASS] 11. HTML template correctly renders .song-remove-history-btn with accessibility attributes and thumbnail wrapper")

    # 11. Verify CSS styles exist in style.css
    with open('music/static/music/css/style.css', 'r', encoding='utf-8') as f:
        css_content = f.read()

    assert '.song-remove-history-btn' in css_content, "Missing .song-remove-history-btn in style.css"
    assert '.recently-played-page .song-cover-thumb-wrapper' in css_content, "Missing .recently-played-page .song-cover-thumb-wrapper in style.css"
    assert 'width: 40px;' in css_content, "Missing width: 40px for compact thumbnail in style.css"
    assert 'height: 40px;' in css_content, "Missing height: 40px for compact thumbnail in style.css"
    print("[PASS] 12. CSS contains .song-remove-history-btn and compact 40px thumbnail rules for .recently-played-page")

    # Cleanup test data
    ListeningHistory.objects.filter(user__in=[user1, user2]).delete()
    playlist_song.delete()
    playlist.delete()
    like.delete()
    song1.delete()
    song2.delete()
    album.delete()
    artist.delete()
    user1.delete()
    user2.delete()

    print("==================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================================")

if __name__ == '__main__':
    run_tests()
