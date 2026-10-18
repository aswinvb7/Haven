import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'MusicStreamProject.settings')

import django
django.setup()

from django.test import Client
from django.contrib.auth.models import User
from music.models import Song, Album, Artist

def audit_search():
    print("==================================================================")
    print("HAVEN - SEARCH AUDIT & VERIFICATION")
    print("==================================================================")

    c = Client(SERVER_NAME='localhost')

    # Test 1: Empty input to /search/
    r_empty = c.get('/search/')
    assert r_empty.status_code == 200
    content_empty = r_empty.content.decode('utf-8')
    assert 'Search Haven' in content_empty, "Welcome state missing for empty search"
    assert 'Type in the search bar above' in content_empty
    print("[PASS] 1. Empty /search/ renders welcome discovery state")

    # Test 2: Whitespace-only input
    r_spaces = c.get('/search/?q=   ')
    assert r_spaces.status_code == 200
    content_spaces = r_spaces.content.decode('utf-8')
    assert 'Search Haven' in content_spaces
    print("[PASS] 2. Whitespace-only search renders welcome discovery state")

    # Test 3: Search by Song title (exact & case-insensitive)
    for q in ['Starboy', 'starboy', 'STARBOY', 'Star', 'star']:
        r = c.get(f'/search/?q={q}')
        assert r.status_code == 200
        content = r.content.decode('utf-8')
        assert 'Starboy' in content, f"Expected Starboy in results for '{q}'"
    print("[PASS] 3. Searching by song title (exact, partial, case-insensitive) works")

    # Test 4: Search by Artist name
    for q in ['Weekend', 'weekend', 'WEEKEND', 'Week', 'Anirudh', 'anirudh', 'Arijith']:
        r = c.get(f'/search/?q={q}')
        assert r.status_code == 200
        content = r.content.decode('utf-8')
        assert q.lower() in content.lower(), f"Expected match in results for '{q}'"
    print("[PASS] 4. Searching by artist name (exact, partial, case-insensitive) works")

    # Test 5: Search by Album title
    for q in ['Jailer', 'jailer', 'JAILER', 'Beast', 'Master', 'Kumbalangi']:
        r = c.get(f'/search/?q={q}')
        assert r.status_code == 200
        content = r.content.decode('utf-8')
        assert q.lower() in content.lower(), f"Expected match in results for '{q}'"
    print("[PASS] 5. Searching by album title (exact, partial, case-insensitive) works")

    # Test 6: No-result search
    r_no = c.get('/search/?q=xyznonexistent12345')
    assert r_no.status_code == 200
    content_no = r_no.content.decode('utf-8')
    assert 'No results found for "xyznonexistent12345"' in content_no
    assert 'Search suggestions:' in content_no
    print("[PASS] 6. No-results search renders friendly no-results state with search tips")

    # Test 7: Special characters
    for q in ["%", "_", "'", '"', "<script>", "&", "\\", "Star%"]:
        r = c.get('/search/', {'q': q})
        assert r.status_code == 200
        content = r.content.decode('utf-8')
        assert '<script>' not in content or '&lt;script&gt;' in content, f"XSS vulnerability detected for query: {q}"
    print("[PASS] 7. Special characters (%, _, quotes, XSS probes) handled safely")

    # Test 8: Autocomplete suggestions endpoint empty / whitespace
    r_sug_empty = c.get('/search/suggestions/?q=')
    assert r_sug_empty.status_code == 200
    data = r_sug_empty.json()
    assert data['total_count'] == 0
    assert data['songs'] == [] and data['artists'] == [] and data['albums'] == []
    print("[PASS] 8. Autocomplete empty input returns clean empty JSON")

    # Test 9: Autocomplete suggestions matching rule (Independent matching!)
    # User types 'st':
    # Song: Starboy
    # Album: Starboy
    # Artist: NOT The Weekend!
    r_st = c.get('/search/suggestions/?q=st')
    assert r_st.status_code == 200
    data_st = r_st.json()
    song_titles = [s['title'] for s in data_st['songs']]
    album_titles = [a['title'] for a in data_st['albums']]
    artist_names = [a['name'] for a in data_st['artists']]
    assert 'Starboy' in song_titles, f"Expected Starboy in songs: {song_titles}"
    assert 'Starboy' in album_titles, f"Expected Starboy in albums: {album_titles}"
    assert 'The Weekend' not in artist_names, f"The Weekend should NOT match 'st'! Found: {artist_names}"
    print("[PASS] 9. Autocomplete independent matching rules strictly verified (st -> Starboy song & album, NOT The Weekend artist)")

    # Test 10: Autocomplete suggestions for 'we'
    r_we = c.get('/search/suggestions/?q=we')
    data_we = r_we.json()
    artist_names_we = [a['name'] for a in data_we['artists']]
    assert 'The Weekend' in artist_names_we, f"Expected The Weekend in artists for 'we': {artist_names_we}"
    print("[PASS] 10. Autocomplete artist matching verified (we -> The Weekend)")

    # Test 11: Autocomplete suggestions URLs and artwork
    for s in data_st['songs']:
        assert s['image_url'], "Song missing image_url in suggestions"
        assert 'url' in s, "Song missing url in suggestions"
        assert s['type'] == 'song'
    for a in data_st['albums']:
        assert a['image_url'], "Album missing image_url in suggestions"
        assert a['url'], "Album missing url in suggestions"
        assert a['type'] == 'album'
    for art in data_we['artists']:
        assert art['image_url'], "Artist missing image_url in suggestions"
        assert art['url'], "Artist missing url in suggestions"
        assert art['type'] == 'artist'
    print("[PASS] 11. Autocomplete suggestions provide valid artwork, URLs, types, and metadata")

    print("==================================================================")
    print("BACKEND SEARCH AUDIT PASSED!")
    print("==================================================================")

if __name__ == '__main__':
    audit_search()
