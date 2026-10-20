import io
import os
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.db import IntegrityError
from music.models import Artist, Album, Song, ListeningHistory, Like, FollowedArtist, UserProfile


class SearchAndDiscoveryTests(TestCase):
    """
    Step 8: Search and Music Discovery automated test suite.
    Validates:
    - Full search view behavior (empty, whitespace, exact, partial, case-insensitive, special characters)
    - Autocomplete suggestions endpoint with strict independent matching rules
    - Query result limits and payload schema
    - Safe query handling and HTML escaping
    - Guest playback restrictions vs. authenticated listening history
    - Artist showcase search view
    """

    def setUp(self):
        self.client = Client()

        # Create test artist, album, and song
        self.artist = Artist.objects.create(name='The Weekend')
        self.album = Album.objects.create(
            title='Starboy',
            artist=self.artist
        )
        self.song = Song.objects.create(
            title='Starboy',
            artist=self.artist,
            album=self.album
        )

        self.artist2 = Artist.objects.create(name='Anirudh Ravichander')
        self.album2 = Album.objects.create(
            title='Jailer',
            artist=self.artist2
        )
        self.song2 = Song.objects.create(
            title='Hukum',
            artist=self.artist2,
            album=self.album2
        )

        self.user = User.objects.create_user(
            username='search_test_user',
            password='TestPassword123!'
        )

    # 1. Empty and whitespace queries
    def test_search_empty_query_renders_welcome_state(self):
        response = self.client.get(reverse('search'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')
        self.assertIn('Search Haven', content)
        self.assertIn('Type in the search bar above', content)

    def test_search_whitespace_query_renders_welcome_state(self):
        response = self.client.get(reverse('search'), {'q': '   '})
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')
        self.assertIn('Search Haven', content)

    # 2. Search by Song, Artist, Album with partial and case-insensitivity
    def test_search_by_song_title(self):
        for query in ['Starboy', 'starboy', 'STARBOY', 'Star', 'star']:
            response = self.client.get(reverse('search'), {'q': query})
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'Starboy')
            self.assertIn(self.song, response.context['songs'])

    def test_search_by_artist_name(self):
        for query in ['Weekend', 'weekend', 'WEEKEND', 'Week']:
            response = self.client.get(reverse('search'), {'q': query})
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'The Weekend')
            self.assertIn(self.artist, response.context['artists'])

    def test_search_by_album_title(self):
        for query in ['Jailer', 'jailer', 'JAILER', 'Jail']:
            response = self.client.get(reverse('search'), {'q': query})
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'Jailer')
            self.assertIn(self.album2, response.context['albums'])

    # 3. No results friendly state
    def test_search_no_results(self):
        response = self.client.get(reverse('search'), {'q': 'nonexistentqueryxyz987'})
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')
        self.assertIn('No results found for "nonexistentqueryxyz987"', content)
        self.assertIn('Search suggestions:', content)
        self.assertIn('Browse Popular Albums', content)

    # 4. Safe query handling & XSS prevention
    def test_search_special_characters_safety(self):
        probes = ['<script>alert("xss")</script>', '%', '_', "'", '"', '\\', '<b>test</b>']
        for probe in probes:
            response = self.client.get(reverse('search'), {'q': probe})
            self.assertEqual(response.status_code, 200)
            content = response.content.decode('utf-8')
            # Verify script tag is never rendered unescaped
            self.assertNotIn('<script>alert("xss")</script>', content)

    # 5. Autocomplete suggestions: empty query
    def test_autocomplete_empty_query(self):
        response = self.client.get(reverse('search_suggestions'), {'q': ''})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['total_count'], 0)
        self.assertEqual(data['songs'], [])
        self.assertEqual(data['artists'], [])
        self.assertEqual(data['albums'], [])

    # 6. Autocomplete suggestions: strict independent matching
    def test_autocomplete_independent_matching(self):
        # Query 'st' matches:
        # - Song 'Starboy' (title contains 'st')
        # - Album 'Starboy' (title contains 'st')
        # - But NOT Artist 'The Weekend' (name does not contain 'st')
        response = self.client.get(reverse('search_suggestions'), {'q': 'st'})
        self.assertEqual(response.status_code, 200)
        data = response.json()

        song_titles = [s['title'] for s in data['songs']]
        album_titles = [a['title'] for a in data['albums']]
        artist_names = [a['name'] for a in data['artists']]

        self.assertIn('Starboy', song_titles)
        self.assertIn('Starboy', album_titles)
        self.assertNotIn('The Weekend', artist_names)

        # Query 'we' matches Artist 'The Weekend', but not Song 'Hukum' or Album 'Jailer'
        response_we = self.client.get(reverse('search_suggestions'), {'q': 'we'})
        self.assertEqual(response_we.status_code, 200)
        data_we = response_we.json()
        we_artist_names = [a['name'] for a in data_we['artists']]
        self.assertIn('The Weekend', we_artist_names)

    # 7. Autocomplete suggestions: payload structure and destination URLs
    def test_autocomplete_payload_structure(self):
        response = self.client.get(reverse('search_suggestions'), {'q': 'Starboy'})
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Song payload verification
        self.assertTrue(len(data['songs']) > 0)
        song_item = data['songs'][0]
        self.assertIn('id', song_item)
        self.assertIn('title', song_item)
        self.assertIn('artist_name', song_item)
        self.assertIn('album_title', song_item)
        self.assertIn('image_url', song_item)
        self.assertIn('audio_url', song_item)
        self.assertIn('type', song_item)
        self.assertEqual(song_item['type'], 'song')

        # Album payload verification
        self.assertTrue(len(data['albums']) > 0)
        album_item = data['albums'][0]
        self.assertIn('id', album_item)
        self.assertIn('title', album_item)
        self.assertIn('url', album_item)
        self.assertEqual(album_item['url'], reverse('album_detail', args=[self.album.id]))
        self.assertEqual(album_item['type'], 'album')

    # 8. Artist showcase via search?artist_id=
    def test_search_artist_showcase(self):
        response = self.client.get(reverse('search'), {'artist_id': self.artist.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['selected_artist'], self.artist)
        self.assertIn(self.album, response.context['artist_albums'])
        self.assertIn(self.song, response.context['artist_songs'])

    # 9. Guest playback restriction vs Authenticated listening history
    def test_guest_cannot_record_listening_history(self):
        response = self.client.post(reverse('record_listen'), {'song_id': self.song.id})
        # Unauthenticated request returns 401 Unauthorized
        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertFalse(data.get('authenticated', True))
        self.assertEqual(ListeningHistory.objects.filter(song=self.song).count(), 0)

    def test_authenticated_user_records_listening_history(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('record_listen'),
            {'song_id': self.song.id},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(ListeningHistory.objects.filter(user=self.user, song=self.song).count(), 1)


class DiscoverAndFollowArtistsTests(TestCase):
    """
    Automated test suite for:
    - Feature 1: Discover (Guest & Auth access, catalog sections, persistent playback controls)
    - Feature 2: Follow Artists (Explicit follow/unfollow, authentication enforcement,
      uniqueness constraints, cross-user isolation, and followed artists page).
    """

    def setUp(self):
        self.client = Client()

        self.artist1 = Artist.objects.create(name='The Weekend')
        self.album1 = Album.objects.create(title='Starboy', artist=self.artist1)
        self.song1 = Song.objects.create(title='Starboy', artist=self.artist1, album=self.album1)

        self.artist2 = Artist.objects.create(name='Anirudh Ravichander')
        self.album2 = Album.objects.create(title='Jailer', artist=self.artist2)
        self.song2 = Song.objects.create(title='Hukum', artist=self.artist2, album=self.album2)

        self.user1 = User.objects.create_user(username='user_alice', password='PasswordAlice123!')
        self.user2 = User.objects.create_user(username='user_bob', password='PasswordBob123!')

    # --- Feature 1: Discover Tests ---

    def test_discover_page_accessible_to_guest(self):
        response = self.client.get(reverse('discover'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Discover Music')
        self.assertIn(self.album1, response.context['albums'])
        self.assertIn(self.artist1, response.context['artists'])
        self.assertIn(self.song1, response.context['songs'])

    def test_discover_page_accessible_to_authenticated_user(self):
        self.client.force_login(self.user1)
        # Alice likes song1 and follows artist1
        Like.objects.create(user=self.user1, song=self.song1)
        FollowedArtist.objects.create(user=self.user1, artist=self.artist1)

        response = self.client.get(reverse('discover'))
        self.assertEqual(response.status_code, 200)
        self.assertIn(self.song1.id, response.context['liked_song_ids'])
        self.assertIn(self.artist1.id, response.context['followed_artist_ids'])

    def test_discover_page_empty_catalog(self):
        Song.objects.all().delete()
        Album.objects.all().delete()
        Artist.objects.all().delete()
        response = self.client.get(reverse('discover'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Music Library Empty')

    # --- Feature 2: Follow Artists Tests ---

    def test_guest_cannot_follow_artist(self):
        # AJAX POST
        response = self.client.post(
            reverse('follow_artist', args=[self.artist1.id]),
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(FollowedArtist.objects.count(), 0)

        # Standard POST redirects to login
        response_std = self.client.post(reverse('follow_artist', args=[self.artist1.id]))
        self.assertEqual(response_std.status_code, 302)
        self.assertIn('/login/', response_std.get('Location'))

    def test_guest_cannot_unfollow_artist(self):
        response = self.client.post(
            reverse('unfollow_artist', args=[self.artist1.id]),
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 401)

    def test_follow_and_unfollow_require_post_method(self):
        self.client.force_login(self.user1)
        # GET follow
        r_get_follow = self.client.get(reverse('follow_artist', args=[self.artist1.id]))
        self.assertEqual(r_get_follow.status_code, 405)

        # GET unfollow
        r_get_unfollow = self.client.get(reverse('unfollow_artist', args=[self.artist1.id]))
        self.assertEqual(r_get_unfollow.status_code, 405)

    def test_authenticated_user_can_follow_artist(self):
        self.client.force_login(self.user1)
        response = self.client.post(
            reverse('follow_artist', args=[self.artist1.id]),
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertTrue(data.get('followed'))
        self.assertEqual(data.get('follower_count'), 1)
        self.assertTrue(FollowedArtist.objects.filter(user=self.user1, artist=self.artist1).exists())

    def test_repeated_follow_is_idempotent_no_duplicates(self):
        self.client.force_login(self.user1)
        # First follow
        self.client.post(reverse('follow_artist', args=[self.artist1.id]), HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        # Repeated follow
        response = self.client.post(reverse('follow_artist', args=[self.artist1.id]), HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('followed'))
        self.assertEqual(FollowedArtist.objects.filter(user=self.user1, artist=self.artist1).count(), 1)

    def test_database_level_unique_constraint(self):
        FollowedArtist.objects.create(user=self.user1, artist=self.artist1)
        with self.assertRaises(IntegrityError):
            FollowedArtist.objects.create(user=self.user1, artist=self.artist1)

    def test_authenticated_user_can_unfollow_artist(self):
        self.client.force_login(self.user1)
        FollowedArtist.objects.create(user=self.user1, artist=self.artist1)

        response = self.client.post(
            reverse('unfollow_artist', args=[self.artist1.id]),
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertFalse(data.get('followed'))
        self.assertEqual(data.get('follower_count'), 0)
        self.assertFalse(FollowedArtist.objects.filter(user=self.user1, artist=self.artist1).exists())

    def test_repeated_unfollow_is_idempotent(self):
        self.client.force_login(self.user1)
        # Unfollow when not following
        response = self.client.post(reverse('unfollow_artist', args=[self.artist1.id]), HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data.get('followed'))
        self.assertEqual(FollowedArtist.objects.filter(user=self.user1, artist=self.artist1).count(), 0)

    def test_cross_user_isolation(self):
        # Alice follows Artist 1; Bob follows Artist 2
        FollowedArtist.objects.create(user=self.user1, artist=self.artist1)
        FollowedArtist.objects.create(user=self.user2, artist=self.artist2)

        # Alice's followed artists view contains only Artist 1
        self.client.force_login(self.user1)
        r_alice = self.client.get(reverse('followed_artists'))
        self.assertEqual(r_alice.status_code, 200)
        self.assertContains(r_alice, self.artist1.name)
        self.assertNotContains(r_alice, self.artist2.name)

        # Bob's followed artists view contains only Artist 2
        self.client.force_login(self.user2)
        r_bob = self.client.get(reverse('followed_artists'))
        self.assertEqual(r_bob.status_code, 200)
        self.assertContains(r_bob, self.artist2.name)
        self.assertNotContains(r_bob, self.artist1.name)

        # Alice cannot unfollow Artist 2 from Bob's list
        self.client.force_login(self.user1)
        self.client.post(reverse('unfollow_artist', args=[self.artist2.id]), HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        # Bob's follow record for Artist 2 must still exist
        self.assertTrue(FollowedArtist.objects.filter(user=self.user2, artist=self.artist2).exists())

    def test_artist_detail_follow_context(self):
        # Guest view
        r_guest = self.client.get(reverse('artist_detail', args=[self.artist1.id]))
        self.assertEqual(r_guest.status_code, 200)
        self.assertFalse(r_guest.context['is_following'])
        self.assertEqual(r_guest.context['follower_count'], 0)

        # Follow as user1
        FollowedArtist.objects.create(user=self.user1, artist=self.artist1)
        self.client.force_login(self.user1)
        r_user1 = self.client.get(reverse('artist_detail', args=[self.artist1.id]))
        self.assertEqual(r_user1.status_code, 200)
        self.assertTrue(r_user1.context['is_following'])
        self.assertEqual(r_user1.context['follower_count'], 1)

    def test_followed_artists_empty_state(self):
        self.client.force_login(self.user1)
        response = self.client.get(reverse('followed_artists'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "You aren't following any artists yet")
        self.assertContains(response, reverse('discover'))

    def test_guest_redirected_from_followed_artists_page(self):
        response = self.client.get(reverse('followed_artists'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response.get('Location'))


class NavbarRedesignAndProfileDropdownTests(TestCase):
    """
    Automated test suite for Navigation Redesign and Profile Dropdown implementation.
    Validates:
    - Authenticated navbar: avatar button with accessibility attributes, no username greeting, no standalone logout
    - Guest navbar: Login and Sign Up buttons present, profile avatar hidden
    - My Profile page authentication requirement (302 redirect to login for guests)
    - My Profile page rendering authenticated user details and personal stats with strict isolation
    - All 6 profile dropdown destinations present in exact required order
    - Main navbar center has History link removed
    - Secure logout flow (POST/GET, session invalidation, redirect to home, guest state restored)
    - Protected pages and media access protection after logout
    """

    def setUp(self):
        self.client = Client()
        self.user1 = User.objects.create_user(
            username='haven_user_one',
            email='user1@havenmusic.test',
            password='Password123!'
        )
        self.user2 = User.objects.create_user(
            username='haven_user_two',
            email='user2@havenmusic.test',
            password='Password123!'
        )

        self.artist = Artist.objects.create(name='Test Artist')
        self.album = Album.objects.create(title='Test Album', artist=self.artist)
        self.song = Song.objects.create(title='Test Song', artist=self.artist, album=self.album)

    def test_authenticated_navbar_shows_profile_avatar_and_no_greeting(self):
        self.client.force_login(self.user1)
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')

        # Profile avatar button with accessibility attributes present
        self.assertIn('id="profileAvatarBtn"', content)
        self.assertIn('aria-label="Open profile menu"', content)
        self.assertIn('aria-haspopup="true"', content)
        self.assertIn('id="profileDropdownMenu"', content)

        # "Hi, username" greeting removed from visible navbar
        self.assertNotIn('class="user-greeting"', content)
        self.assertNotIn(f'Hi, <strong style="color: var(--text-primary);">{self.user1.username}</strong>', content)

        # Standalone logout button removed from navbar actions
        self.assertNotIn('<a href="/logout/" class="btn btn-secondary"', content)

    def test_guest_navbar_shows_login_and_signup_and_no_avatar(self):
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')

        # Guest buttons present
        self.assertIn('href="/login/"', content)
        self.assertIn('href="/signup/"', content)

        # Profile avatar and dropdown absent
        self.assertNotIn('id="profileAvatarBtn"', content)
        self.assertNotIn('id="profileDropdownMenu"', content)

    def test_profile_page_requires_authentication(self):
        response = self.client.get(reverse('profile'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response.get('Location'))

    def test_authenticated_user_can_access_profile_page(self):
        self.client.force_login(self.user1)
        response = self.client.get(reverse('profile'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')

        self.assertIn(self.user1.username, content)
        self.assertIn(self.user1.email, content)
        self.assertIn('Haven Member', content)
        self.assertIn('Recently Played', content)
        self.assertIn('Liked Songs', content)
        self.assertIn('Playlists', content)
        self.assertIn('Followed Artists', content)

    def test_profile_page_strict_user_isolation(self):
        # User 1 creates 1 playlist, 1 like, 1 follow
        from music.models import Playlist, Like, FollowedArtist
        Playlist.objects.create(user=self.user1, name='User1 Playlist')
        Like.objects.create(user=self.user1, song=self.song)
        FollowedArtist.objects.create(user=self.user1, artist=self.artist)

        # User 1 views profile
        self.client.force_login(self.user1)
        r1 = self.client.get(reverse('profile'))
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.context['profile_user'], self.user1)
        self.assertEqual(r1.context['playlist_count'], 1)
        self.assertEqual(r1.context['liked_songs_count'], 1)
        self.assertEqual(r1.context['followed_artists_count'], 1)

        # User 2 views profile (has 0 items)
        self.client.force_login(self.user2)
        r2 = self.client.get(reverse('profile'))
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.context['profile_user'], self.user2)
        self.assertEqual(r2.context['playlist_count'], 0)
        self.assertEqual(r2.context['liked_songs_count'], 0)
        self.assertEqual(r2.context['followed_artists_count'], 0)
        self.assertNotIn(self.user1.username, r2.content.decode('utf-8'))

    def test_profile_dropdown_contains_all_six_destinations_in_order(self):
        self.client.force_login(self.user1)
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')

        # Verify all 6 URLs are in the content
        profile_url = reverse('profile')
        history_url = reverse('recently_played')
        likes_url = reverse('liked_songs')
        playlists_url = reverse('playlist_list')
        following_url = reverse('followed_artists')
        logout_url = reverse('logout')

        self.assertIn(profile_url, content)
        self.assertIn(history_url, content)
        self.assertIn(likes_url, content)
        self.assertIn(playlists_url, content)
        self.assertIn(following_url, content)
        self.assertIn(logout_url, content)

        # Find positions within dropdown menu to verify exact order
        dropdown_start = content.find('id="profileDropdownMenu"')
        self.assertNotEqual(dropdown_start, -1)
        dropdown_html = content[dropdown_start:]

        idx_profile = dropdown_html.find(f'href="{profile_url}"')
        idx_history = dropdown_html.find(f'href="{history_url}"')
        idx_likes = dropdown_html.find(f'href="{likes_url}"')
        idx_playlists = dropdown_html.find(f'href="{playlists_url}"')
        idx_following = dropdown_html.find(f'href="{following_url}"')
        idx_logout = dropdown_html.find(f'action="{logout_url}"')

        self.assertTrue(idx_profile < idx_history, "My Profile must precede Recently Played")
        self.assertTrue(idx_history < idx_likes, "Recently Played must precede Liked Songs")
        self.assertTrue(idx_likes < idx_playlists, "Liked Songs must precede My Playlists")
        self.assertTrue(idx_playlists < idx_following, "My Playlists must precede Followed Artists")
        self.assertTrue(idx_following < idx_logout, "Followed Artists must precede Logout")

    def test_history_link_removed_from_main_navbar(self):
        self.client.force_login(self.user1)
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')

        # Nav center should not contain data-section="history"
        nav_center_start = content.find('class="nav-center"')
        nav_center_end = content.find('</nav>', nav_center_start)
        nav_center_html = content[nav_center_start:nav_center_end]

        self.assertNotIn('data-section="history"', nav_center_html)

    def test_logout_post_clears_session_and_redirects_to_home(self):
        self.client.force_login(self.user1)
        # Verify authenticated session
        self.assertIn('_auth_user_id', self.client.session)

        # Post to logout
        response = self.client.post(reverse('logout'))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.get('Location'), reverse('home'))

        # Session should no longer have authenticated user
        self.assertNotIn('_auth_user_id', self.client.session)

        # Follow redirect to home
        home_response = self.client.get(reverse('home'))
        self.assertEqual(home_response.status_code, 200)
        home_content = home_response.content.decode('utf-8')
        self.assertIn('href="/login/"', home_content)
        self.assertIn('href="/signup/"', home_content)
        self.assertNotIn('id="profileAvatarBtn"', home_content)

    def test_protected_pages_redirect_after_logout(self):
        self.client.force_login(self.user1)
        self.client.post(reverse('logout'))

        # Protected pages must redirect
        for route_name in ['profile', 'liked_songs', 'create_playlist', 'followed_artists', 'recently_played']:
            res = self.client.get(reverse(route_name))
            self.assertEqual(res.status_code, 302, f"Route '{route_name}' should redirect unauthenticated user")
            self.assertIn('/login/', res.get('Location'))


class ProfileAvatarCustomizationTests(TestCase):
    """
    Premium Profile Avatar, Profile Picture Upload, and Navbar Refinement test suite.
    Validates:
    - Default avatar rendering for users without customization
    - Built-in avatar preset selection (avatar-1 to avatar-6) and database updates
    - Custom profile image uploads (JPEG, PNG, WebP) with Pillow verification
    - Safe unique filenames and file cleanup
    - File validation: rejection of oversized (>5MB) and non-image files
    - Reset to default avatar
    - User profile data isolation
    - Synchronized avatar availability in context processor and templates
    - Discover link removed from .nav-center while page remains functional
    """

    def setUp(self):
        self.client = Client()
        self.user1 = User.objects.create_user(
            username='avatar_user1',
            email='avatar1@example.com',
            password='TestPassword123!'
        )
        self.user2 = User.objects.create_user(
            username='avatar_user2',
            email='avatar2@example.com',
            password='TestPassword123!'
        )

    def _create_test_image(self, format='JPEG', size=(60, 60), color=(139, 92, 246)):
        buf = io.BytesIO()
        img = Image.new('RGB', size, color)
        img.save(buf, format=format)
        buf.seek(0)
        ext = 'jpg' if format.upper() == 'JPEG' else format.lower()
        content_type = 'image/jpeg' if format.upper() == 'JPEG' else f'image/{format.lower()}'
        return SimpleUploadedFile(f'avatar_test.{ext}', buf.read(), content_type=content_type)

    def test_default_avatar_display_for_new_user(self):
        self.client.force_login(self.user1)
        response = self.client.get(reverse('profile'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="profilePageAvatarContainer"')
        self.assertContains(response, 'id="profilePageAvatarImg"')
        self.assertContains(response, '/static/music/images/avatars/default-avatar.png')
        self.assertContains(response, 'id="navbarAvatarContainer"')
        self.assertContains(response, 'id="dropdownAvatarContainer"')

    def test_context_processor_provides_profile_and_avatar(self):
        self.client.force_login(self.user1)
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('user_profile', response.context)
        self.assertIn('user_avatar_url', response.context)
        self.assertEqual(response.context['user_avatar_url'], '/static/music/images/avatars/default-avatar.png')

    def test_select_preset_avatar_ajax(self):
        self.client.force_login(self.user1)
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_preset': 'avatar-2', 'action': 'preset'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('preset'), 'avatar-2')
        self.assertIn('/static/music/images/avatars/avatar-2.svg', data.get('avatar_url'))

        # Check DB
        profile = UserProfile.objects.get(user=self.user1)
        self.assertEqual(profile.avatar_preset, 'avatar-2')
        self.assertFalse(bool(profile.avatar_image))
        self.assertEqual(profile.get_avatar_url(), '/static/music/images/avatars/avatar-2.svg')

    def test_upload_valid_jpeg_image_ajax(self):
        self.client.force_login(self.user1)
        test_file = self._create_test_image(format='JPEG')
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': test_file, 'action': 'upload'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertIn('/media/profile_pictures/user_', data.get('avatar_url'))

        # Check DB
        profile = UserProfile.objects.get(user=self.user1)
        self.assertTrue(bool(profile.avatar_image))
        self.assertEqual(profile.avatar_preset, '')
        self.assertIn(f'user_{self.user1.id}_', profile.avatar_image.name)

        # Cleanup created media file
        if profile.avatar_image and os.path.exists(profile.avatar_image.path):
            try:
                os.remove(profile.avatar_image.path)
            except OSError:
                pass

    def test_upload_valid_png_and_webp_images(self):
        self.client.force_login(self.user1)
        for fmt in ['PNG', 'WEBP']:
            test_file = self._create_test_image(format=fmt)
            response = self.client.post(
                reverse('update_profile_avatar'),
                {'avatar_image': test_file},
                HTTP_X_REQUESTED_WITH='XMLHttpRequest'
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data.get('success'))

            profile = UserProfile.objects.get(user=self.user1)
            self.assertTrue(bool(profile.avatar_image))
            if os.path.exists(profile.avatar_image.path):
                try:
                    os.remove(profile.avatar_image.path)
                except OSError:
                    pass

    def test_reject_oversized_image(self):
        self.client.force_login(self.user1)
        # Create dummy file > 5 MB
        oversized_data = b'x' * (5 * 1024 * 1024 + 1024)
        big_file = SimpleUploadedFile('large.jpg', oversized_data, content_type='image/jpeg')
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': big_file},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('5 MB', data.get('error', ''))

    def test_reject_invalid_corrupted_image(self):
        self.client.force_login(self.user1)
        # Corrupt file with .png extension but plain text content
        fake_file = SimpleUploadedFile('malicious.png', b'This is not a real PNG image', content_type='image/png')
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': fake_file},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('Invalid image', data.get('error', ''))

    def test_reject_disallowed_extension(self):
        self.client.force_login(self.user1)
        fake_file = SimpleUploadedFile('script.exe', b'binary content', content_type='application/octet-stream')
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': fake_file},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('Unsupported', data.get('error', ''))

    def test_reset_avatar_to_default(self):
        self.client.force_login(self.user1)
        # Set a preset first
        profile, _ = UserProfile.objects.get_or_create(user=self.user1)
        profile.avatar_preset = 'avatar-4'
        profile.save()

        # Reset to default
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'action': 'reset_default'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertTrue(data.get('is_default'))
        self.assertEqual(data.get('avatar_url'), '/static/music/images/avatars/default-avatar.png')

        profile.refresh_from_db()
        self.assertEqual(profile.avatar_preset, '')
        self.assertFalse(bool(profile.avatar_image))
        self.assertTrue(profile.is_default_avatar())
        self.assertEqual(profile.get_avatar_url(), '/static/music/images/avatars/default-avatar.png')

    def test_user_isolation(self):
        # User 1 sets preset avatar-3
        profile1, _ = UserProfile.objects.get_or_create(user=self.user1)
        profile1.avatar_preset = 'avatar-3'
        profile1.save()

        # User 2 logs in and sets preset avatar-5
        self.client.force_login(self.user2)
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_preset': 'avatar-5', 'action': 'preset'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)

        # Verify User 1's profile is unchanged
        profile1.refresh_from_db()
        self.assertEqual(profile1.avatar_preset, 'avatar-3')

        # Verify User 2 has avatar-5
        profile2 = UserProfile.objects.get(user=self.user2)
        self.assertEqual(profile2.avatar_preset, 'avatar-5')

    def test_unauthenticated_user_redirected_from_avatar_update(self):
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_preset': 'avatar-1'}
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response.get('Location'))

    def test_discover_removed_from_nav_center_but_page_accessible(self):
        self.client.force_login(self.user1)
        home_res = self.client.get(reverse('home'))
        self.assertEqual(home_res.status_code, 200)
        home_content = home_res.content.decode('utf-8')

        # Discover should NOT be in nav-center
        nav_center_start = home_content.find('class="nav-center"')
        nav_center_end = home_content.find('</nav>', nav_center_start)
        nav_center_html = home_content[nav_center_start:nav_center_end]
        self.assertNotIn('data-section="discover"', nav_center_html)
        self.assertNotIn('/discover/', nav_center_html)

        # Discover page is still directly accessible
        discover_res = self.client.get(reverse('discover'))
        self.assertEqual(discover_res.status_code, 200)
        self.assertContains(discover_res, 'Discover Music')

    def test_default_headset_avatar_file_exists(self):
        """Verify that the headset boy default avatar assets exist and can be loaded."""
        from django.conf import settings
        avatar_path = os.path.join(settings.BASE_DIR, 'music', 'static', 'music', 'images', 'avatars', 'default-avatar.png')
        self.assertTrue(os.path.exists(avatar_path), f"Default avatar not found at {avatar_path}")
        with Image.open(avatar_path) as img:
            self.assertEqual(img.size, (512, 512))
            self.assertEqual(img.format, 'PNG')

    def test_avatar_update_csrf_protection(self):
        """Verify that POST without valid CSRF is rejected when CSRF checks are enforced."""
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.user1)
        response = csrf_client.post(
            reverse('update_profile_avatar'),
            {'avatar_preset': 'avatar-1'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 403)

    def test_upload_valid_jff_file_with_jpeg_content(self):
        """Verify that uploading a .jff file with genuine JPEG content is accepted and saved."""
        self.client.force_login(self.user1)
        buf = io.BytesIO()
        img = Image.new('RGB', (80, 80), (79, 70, 229))
        img.save(buf, format='JPEG')
        buf.seek(0)
        valid_jff = SimpleUploadedFile('weekend.jff', buf.read(), content_type='image/jpeg')

        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': valid_jff, 'action': 'upload'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertIn('/media/profile_pictures/user_', data.get('avatar_url'))

        # Check DB and file normalization
        profile = UserProfile.objects.get(user=self.user1)
        self.assertTrue(bool(profile.avatar_image))
        self.assertEqual(profile.avatar_preset, '')
        self.assertTrue(profile.avatar_image.name.endswith('.jpg'))
        self.assertTrue(os.path.exists(profile.avatar_image.path))

        # Cleanup media
        if profile.avatar_image and os.path.exists(profile.avatar_image.path):
            try:
                os.remove(profile.avatar_image.path)
            except OSError:
                pass

    def test_reject_invalid_jff_file_with_non_image_content(self):
        """A .jff extension is not a supported format. Reject it unless verified as genuine image content."""
        self.client.force_login(self.user1)
        fake_jff = SimpleUploadedFile('weekend.jff', b'This is plain text and not a JPEG', content_type='application/octet-stream')
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': fake_jff, 'action': 'upload'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('Invalid image', data.get('error', ''))

        # DB remains unchanged
        profile = UserProfile.objects.filter(user=self.user1).first()
        if profile:
            self.assertFalse(bool(profile.avatar_image))

    def test_reject_renamed_fake_image_file(self):
        """Never accept a file solely because its extension was renamed to .jpg or .png."""
        self.client.force_login(self.user1)
        fake_jpg = SimpleUploadedFile('weekend.jpg', b'<script>alert("hack")</script>', content_type='image/jpeg')
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': fake_jpg, 'action': 'upload'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('Invalid image', data.get('error', ''))

    def test_reject_unsupported_format_even_if_renamed(self):
        """Reject genuinely unsupported image formats like BMP even if renamed to .jff or .jpg."""
        self.client.force_login(self.user1)
        buf = io.BytesIO()
        img = Image.new('RGB', (60, 60), (255, 0, 0))
        img.save(buf, format='BMP')
        buf.seek(0)
        bmp_as_jff = SimpleUploadedFile('photo.jff', buf.read(), content_type='image/x-ms-bmp')
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': bmp_as_jff, 'action': 'upload'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('Unsupported image format', data.get('error', ''))

    def test_failed_upload_preserves_existing_avatar(self):
        """Prevent invalid uploads from replacing an existing valid avatar."""
        self.client.force_login(self.user1)
        profile, _ = UserProfile.objects.get_or_create(user=self.user1)
        profile.avatar_preset = 'avatar-2'
        profile.save()

        # Attempt invalid upload
        fake_file = SimpleUploadedFile('bad.jff', b'corrupt', content_type='application/octet-stream')
        response = self.client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': fake_file},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(response.status_code, 400)

        profile.refresh_from_db()
        self.assertEqual(profile.avatar_preset, 'avatar-2')
        self.assertFalse(bool(profile.avatar_image))
        self.assertEqual(profile.get_avatar_url(), '/static/music/images/avatars/avatar-2.svg')


class HomepageRecentlyPlayedVisibilityTests(TestCase):
    """
    Test suite for homepage Recently Played section visibility:
    - Hidden when user is unauthenticated
    - Hidden when authenticated user has empty history (no gap, heading, or empty-state message)
    - Displayed when authenticated user has 1+ listening history records
    - Strict user data isolation: new users never see another user's history
    """

    def setUp(self):
        self.client = Client()
        self.user1 = User.objects.create_user(
            username='history_user1',
            email='history1@example.com',
            password='TestPassword123!'
        )
        self.user2 = User.objects.create_user(
            username='history_user2',
            email='history2@example.com',
            password='TestPassword123!'
        )
        self.artist = Artist.objects.create(name='Star Artist')
        self.album = Album.objects.create(title='Star Album', artist=self.artist)
        self.song = Song.objects.create(title='Star Song', artist=self.artist, album=self.album)

    def test_unauthenticated_guest_does_not_see_recently_played_section(self):
        """Guest users should not see the Recently Played section or heading on the homepage."""
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')
        self.assertNotIn('id="recently-played"', content)
        self.assertNotIn('class="recently-played-section"', content)
        self.assertNotIn('No listening history yet', content)

    def test_authenticated_user_with_empty_history_does_not_see_recently_played_section(self):
        """When an authenticated user has zero listening history, hide the entire section."""
        self.client.force_login(self.user1)
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')
        self.assertNotIn('id="recently-played"', content)
        self.assertNotIn('class="recently-played-section"', content)
        self.assertNotIn('Pick up where you left off.', content)
        self.assertNotIn('No listening history yet', content)
        self.assertNotIn('recentlyPlayedGrid', content)

    def test_authenticated_user_with_listening_history_sees_recently_played_section(self):
        """When an authenticated user has 1+ history records, display the section normally."""
        ListeningHistory.objects.create(user=self.user1, song=self.song)
        self.client.force_login(self.user1)
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')
        self.assertIn('id="recently-played"', content)
        self.assertIn('Recently Played', content)
        self.assertIn('Pick up where you left off.', content)
        self.assertIn('Star Song', content)
        self.assertIn('Star Artist', content)
        self.assertNotIn('No listening history yet', content)

    def test_user_isolation_for_homepage_recently_played(self):
        """Ensure history is scoped to the current user; User 2 must not see User 1's history."""
        # User 1 listens to music
        ListeningHistory.objects.create(user=self.user1, song=self.song)

        # User 2 logs in with zero history
        self.client.force_login(self.user2)
        response2 = self.client.get(reverse('home'))
        self.assertEqual(response2.status_code, 200)
        content2 = response2.content.decode('utf-8')
        # Section should be completely hidden for User 2
        self.assertNotIn('id="recently-played"', content2)
        self.assertNotIn('Star Song', content2)
        self.assertNotIn('No listening history yet', content2)

        # User 1 logs in and sees their history
        self.client.force_login(self.user1)
        response1 = self.client.get(reverse('home'))
        self.assertEqual(response1.status_code, 200)
        content1 = response1.content.decode('utf-8')
        self.assertIn('id="recently-played"', content1)
        self.assertIn('Star Song', content1)





