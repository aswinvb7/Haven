import json
import os
import uuid
from PIL import Image
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.templatetags.static import static
from django.urls import reverse
from django.db import IntegrityError, transaction
from django.db.models import Q, Count, Max
from django.contrib import messages
from django.contrib.auth import logout
from datetime import timedelta
from django.utils import timezone
from .models import Album, Artist, Song, Like, Playlist, PlaylistSong, ListeningHistory, FollowedArtist, UserProfile
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from django.utils.http import url_has_allowed_host_and_scheme

def home(request):

    """
    Homepage view for Haven music streaming platform.
    Allows browsing for all visitors. Unauthenticated users view locked playback cards.
    Gracefully falls back to curated sample data when the database is empty.
    """
    # Curated sample album data matching design reference
    sample_albums = [
        {
            'title': 'Midnight Vibes',
            'artist': {'name': 'Various Artists'},
            'cover_image': 'music/images/album-midnight-vibes.svg',
            'is_locked': True,
        },
        {
            'title': 'Chill Beats',
            'artist': {'name': 'LoFi Studio'},
            'cover_image': 'music/images/album-chill-beats.svg',
            'is_locked': True,
        },
        {
            'title': 'Ocean Eyes',
            'artist': {'name': 'The Waves'},
            'cover_image': 'music/images/album-ocean-eyes.svg',
            'is_locked': True,
        },
        {
            'title': 'Serenity',
            'artist': {'name': 'Calm Collective'},
            'cover_image': 'music/images/album-serenity.svg',
            'is_locked': True,
        },
        {
            'title': 'Lost in You',
            'artist': {'name': 'Arijit Singh'},
            'cover_image': 'music/images/album-lost-in-you.svg',
            'is_locked': True,
        },
    ]

    # Real photographic artist portraits from different industries
    sample_artists = [
        {
            'name': 'The Weeknd',
            'image': 'music/images/artist-the-weeknd.jpg',
            'industry': 'Hollywood / International',
        },
        {
            'name': 'Anirudh Ravichander',
            'image': 'music/images/artist-anirudh-ravichander.jpg',
            'industry': 'Tollywood / Telugu',
        },
        {
            'name': 'Sushin Shyam',
            'image': 'music/images/artist-sushin-shyam.jpg',
            'industry': 'Mollywood / Malayalam',
        },
        {
            'name': 'Arijit Singh',
            'image': 'music/images/artist-arijit-singh.jpg',
            'industry': 'Bollywood / Hindi',
        },
    ]

    try:
        db_albums = list(Album.objects.select_related('artist').all()[:50])
        db_artists = list(Artist.objects.all()[:50])
    except Exception:
        db_albums = []
        db_artists = []

    albums = db_albums if len(db_albums) > 0 else sample_albums
    artists = db_artists if len(db_artists) > 0 else sample_artists

    recently_played = []
    liked_song_ids = set()
    if request.user.is_authenticated:
        try:
            records = (
                ListeningHistory.objects.filter(user=request.user)
                .select_related('song', 'song__artist', 'song__album')
                .order_by('-played_at')[:60]
            )
            seen_ids = set()
            for r in records:
                if r.song_id not in seen_ids:
                    seen_ids.add(r.song_id)
                    r.song.last_played_at = r.played_at
                    recently_played.append(r.song)
                    if len(recently_played) >= 6:
                        break
            if recently_played:
                liked_song_ids = set(
                    Like.objects.filter(user=request.user, song__in=recently_played).values_list('song_id', flat=True)
                )
        except Exception:
            recently_played = []

    context = {
        'albums': albums,
        'artists': artists,
        'recently_played': recently_played,
        'liked_song_ids': liked_song_ids,
    }
    return render(request, 'music/home.html', context)


def album_detail(request, album_id):
    album = get_object_or_404(Album, id=album_id)
    songs = Song.objects.filter(album=album)

    liked_song_ids = set()
    if request.user.is_authenticated:
        liked_song_ids = set(
            Like.objects.filter(user=request.user, song__in=songs).values_list('song_id', flat=True)
        )

    context = {
        'album': album,
        'songs': songs,
        'liked_song_ids': liked_song_ids,
    }

    return render(request, 'music/album_detail.html', context)


def artist_detail(request, artist_id):
    """
    Dedicated Artist Detail view for Haven music streaming application.
    Displays the artist's profile, discography (albums), songs, and follow status.
    """
    artist = get_object_or_404(Artist, id=artist_id)
    albums = Album.objects.filter(artist=artist)
    songs = Song.objects.filter(artist=artist).select_related('album', 'artist')

    is_following = False
    if request.user.is_authenticated:
        is_following = FollowedArtist.objects.filter(user=request.user, artist=artist).exists()

    follower_count = artist.followers.count()

    context = {
        'artist': artist,
        'albums': albums,
        'songs': songs,
        'is_following': is_following,
        'follower_count': follower_count,
    }

    return render(request, 'music/artist_detail.html', context)


def search(request):
    """
    Search view for Haven music streaming application.
    Supports case-insensitive partial searches across songs, albums, and artists.
    Supports viewing an artist and their associated albums via ?artist_id=<id>.
    """
    query = request.GET.get('q', '').strip()
    artist_id = request.GET.get('artist_id', '').strip()
    from_q = request.GET.get('from_q', '').strip()

    selected_artist = None
    artist_albums = []
    artist_songs = []

    if artist_id:
        try:
            selected_artist = Artist.objects.get(id=int(artist_id))
            artist_albums = list(Album.objects.filter(artist=selected_artist).select_related('artist'))
            artist_songs = list(Song.objects.filter(artist=selected_artist).select_related('album', 'artist'))
        except (Artist.DoesNotExist, ValueError):
            selected_artist = None

    songs = []
    albums = []
    artists = []
    total_count = 0

    if query:
        songs = list(
            Song.objects.filter(
                Q(title__icontains=query) |
                Q(artist__name__icontains=query) |
                Q(album__title__icontains=query)
            ).select_related('artist', 'album').distinct()[:50]
        )

        albums = list(
            Album.objects.filter(
                Q(title__icontains=query) |
                Q(artist__name__icontains=query)
            ).select_related('artist').distinct()[:50]
        )

        artists = list(
            Artist.objects.filter(
                name__icontains=query
            ).distinct()[:50]
        )

        total_count = len(songs) + len(albums) + len(artists)

    context = {
        'query': query,
        'from_q': from_q,
        'selected_artist': selected_artist,
        'artist_albums': artist_albums,
        'artist_songs': artist_songs,
        'songs': songs,
        'albums': albums,
        'artists': artists,
        'total_count': total_count,
    }

    return render(request, 'music/search_results.html', context)


def user_logout(request):
    logout(request)
    return redirect('home')


def signup(request):
    next_url = request.POST.get('next') or request.GET.get('next') or ''
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')

        if password != confirm_password:
            return render(request, 'music/signup.html', {
                'error': 'Passwords do not match.',
                'next': next_url,
            })

        if User.objects.filter(username=username).exists():
            return render(request, 'music/signup.html', {
                'error': 'Username already exists.',
                'next': next_url,
            })

        User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
                return redirect(next_url)

        return redirect('home')

    return render(request, 'music/signup.html', {'next': next_url})



def user_login(request):
    next_url = request.POST.get('next') or request.GET.get('next') or ''
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
                return redirect(next_url)
            return redirect('home')

        return render(request, 'music/login.html', {
            'error': 'Invalid username or password.',
            'next': next_url,
        })

    return render(request, 'music/login.html', {'next': next_url})


def search_suggestions(request):
    """
    Live autocomplete search suggestions endpoint.
    Strict independent matching:
      - Songs matched ONLY by Song.title
      - Artists matched ONLY by Artist.name
      - Albums matched ONLY by Album.title
    Prioritizes items whose name starts with the query (prefix match),
    then includes remaining partial matches.
    Caps each category at 5 items.
    """
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({
            'query': '',
            'songs': [],
            'artists': [],
            'albums': [],
            'total_count': 0
        })

    default_image = static('music/images/album-midnight-vibes.svg')
    q_lower = query.lower()

    # 1. Songs: matched ONLY against Song title
    song_qs = Song.objects.filter(title__icontains=query).select_related('artist', 'album')
    songs_sorted = sorted(
        song_qs,
        key=lambda s: (0 if s.title.lower().startswith(q_lower) else 1, s.title.lower())
    )[:5]

    songs_data = []
    for s in songs_sorted:
        cover_url = default_image
        if s.album and s.album.cover_image:
            cover_url = s.album.cover_image.url
        elif s.artist and s.artist.image:
            cover_url = s.artist.image.url

        artist_name = s.artist.name if s.artist else (s.album.artist.name if s.album and s.album.artist else '')
        album_title = s.album.title if s.album else ''
        album_id = s.album.id if s.album else None

        songs_data.append({
            'id': s.id,
            'title': s.title,
            'artist_name': artist_name,
            'album_title': album_title,
            'album_id': album_id,
            'image_url': cover_url,
            'audio_url': s.audio_file.url if s.audio_file else '',
            'url': reverse('album_detail', args=[album_id]) if album_id else '#',
            'type': 'song'
        })

    # 2. Artists: matched ONLY against Artist name
    artist_qs = Artist.objects.filter(name__icontains=query)
    artists_sorted = sorted(
        artist_qs,
        key=lambda a: (0 if a.name.lower().startswith(q_lower) else 1, a.name.lower())
    )[:5]

    artists_data = []
    for a in artists_sorted:
        img_url = a.image.url if a.image else default_image
        album_count = a.album_set.count()
        artists_data.append({
            'id': a.id,
            'name': a.name,
            'subtitle': f"{album_count} Album{'s' if album_count != 1 else ''}" if album_count > 0 else 'Artist',
            'image_url': img_url,
            'url': reverse('artist_detail', args=[a.id]),
            'type': 'artist'
        })

    # 3. Albums: matched ONLY against Album title
    album_qs = Album.objects.filter(title__icontains=query).select_related('artist')
    albums_sorted = sorted(
        album_qs,
        key=lambda alb: (0 if alb.title.lower().startswith(q_lower) else 1, alb.title.lower())
    )[:5]

    albums_data = []
    for alb in albums_sorted:
        cover_url = alb.cover_image.url if alb.cover_image else default_image
        artist_name = alb.artist.name if alb.artist else 'Various Artists'
        albums_data.append({
            'id': alb.id,
            'title': alb.title,
            'artist_name': artist_name,
            'image_url': cover_url,
            'url': reverse('album_detail', args=[alb.id]),
            'type': 'album'
        })

    total_count = len(songs_data) + len(artists_data) + len(albums_data)

    return JsonResponse({
        'query': query,
        'songs': songs_data,
        'artists': artists_data,
        'albums': albums_data,
        'total_count': total_count
    })


def toggle_like(request, song_id):
    """
    Toggle Like/Unlike status for a song.
    Requirements:
      - Accepts POST requests only.
      - Requires the user to be authenticated.
      - Safely retrieves the song or returns 404.
      - Uses get_or_create() if unliked and deletes if already liked.
      - Prevents duplicate Like records and does not delete likes of other users.
      - Returns appropriate JSON response and HTTP status codes.
    """
    if request.method != 'POST':
        return JsonResponse(
            {'error': 'Method not allowed. POST required.'},
            status=405
        )

    if not request.user.is_authenticated:
        return JsonResponse(
            {'error': 'Authentication required. Please log in.', 'authenticated': False},
            status=401
        )

    try:
        song = Song.objects.get(id=song_id)
    except Song.DoesNotExist:
        return JsonResponse(
            {'error': 'Song not found.'},
            status=404
        )

    user_likes = Like.objects.filter(user=request.user, song=song)
    if user_likes.exists():
        user_likes.delete()
        return JsonResponse({
            'liked': False,
            'song_id': song.id,
            'message': f'"{song.title}" unliked.'
        }, status=200)
    else:
        Like.objects.get_or_create(user=request.user, song=song)
        return JsonResponse({
            'liked': True,
            'song_id': song.id,
            'message': f'"{song.title}" liked.'
        }, status=200)


@login_required(login_url='login')
def liked_songs(request):
    """
    Display songs favorited/liked by the authenticated user.
    Uses select_related to efficiently retrieve song, artist, and album relationships.
    """
    likes = Like.objects.filter(user=request.user).select_related(
        'song',
        'song__artist',
        'song__album',
        'song__album__artist'
    ).order_by('-created_at')

    songs = [like.song for like in likes]
    liked_song_ids = {song.id for song in songs}

    return render(request, 'music/liked_songs.html', {
        'songs': songs,
        'liked_song_ids': liked_song_ids,
        'total_count': len(songs),
    })


PRESET_COVERS = [
    {'id': 'preset-1', 'name': 'Neon Violet', 'file': 'music/images/presets/preset-1.svg'},
    {'id': 'preset-2', 'name': 'Cyber Cyan', 'file': 'music/images/presets/preset-2.svg'},
    {'id': 'preset-3', 'name': 'Midnight Beats', 'file': 'music/images/presets/preset-3.svg'},
    {'id': 'preset-4', 'name': 'Sunset Horizon', 'file': 'music/images/presets/preset-4.svg'},
    {'id': 'preset-5', 'name': 'Emerald Chill', 'file': 'music/images/presets/preset-5.svg'},
    {'id': 'preset-6', 'name': 'Rose Pulse', 'file': 'music/images/presets/preset-6.svg'},
]
VALID_PRESET_IDS = {p['id'] for p in PRESET_COVERS}


@login_required(login_url='login')
def playlist_list(request):
    """
    Display playlists created by the authenticated user.
    Each playlist card shows cover artwork, name, and total song count.
    """
    playlists = Playlist.objects.filter(user=request.user).annotate(
        song_count=Count('playlist_songs')
    ).order_by('-updated_at')

    return render(request, 'music/playlist_list.html', {
        'playlists': playlists,
        'total_count': playlists.count(),
    })


@login_required(login_url='login')
def create_playlist(request):
    """
    Create a new playlist for the authenticated user.
    Supports playlist name (emojis/Unicode), optional description,
    preset cover gallery selection, or optional custom cover image upload.
    If initiated from "Add to Playlist", automatically attaches the pending song upon creation.
    """
    error = None
    name_value = ''
    desc_value = ''
    selected_preset = 'preset-1'
    pending_song = None

    # Read optional song_id from POST or GET (handles modal flow and form validation failure)
    song_id_raw = request.POST.get('song_id') or request.GET.get('song_id')
    if song_id_raw:
        try:
            pending_song = Song.objects.filter(id=int(song_id_raw)).select_related('artist', 'album').first()
        except (ValueError, TypeError):
            pending_song = None

    if request.method == 'POST':
        name_value = request.POST.get('name', '').strip()
        desc_value = request.POST.get('description', '').strip()
        preset_cover = request.POST.get('preset_cover', 'preset-1').strip()
        custom_cover = request.FILES.get('custom_cover')

        if preset_cover in VALID_PRESET_IDS:
            selected_preset = preset_cover

        if not name_value:
            error = 'Please enter a name for your playlist.'
        else:
            if preset_cover not in VALID_PRESET_IDS:
                preset_cover = 'preset-1'

            playlist = Playlist(
                user=request.user,
                name=name_value,
                description=desc_value,
                preset_cover=preset_cover,
            )
            if custom_cover:
                playlist.custom_cover = custom_cover

            playlist.save()

            # If created from "Add to Playlist", attach pending track as the first song (order 0)
            if pending_song:
                PlaylistSong.objects.create(
                    playlist=playlist,
                    song=pending_song,
                    order=0
                )
                playlist.save(update_fields=['updated_at'])

            return redirect('playlist_detail', playlist_id=playlist.id)

    return render(request, 'music/create_playlist.html', {
        'presets': PRESET_COVERS,
        'default_preset': selected_preset,
        'error': error,
        'name_value': name_value,
        'desc_value': desc_value,
        'pending_song': pending_song,
        'pending_song_id': pending_song.id if pending_song else '',
    })


@login_required(login_url='login')
def playlist_detail(request, playlist_id):
    """
    Display details of a specific playlist owned by the authenticated user.
    Enforces strict private ownership: users cannot view or modify another user's playlists.
    """
    playlist = get_object_or_404(Playlist, id=playlist_id, user=request.user)

    playlist_songs = playlist.playlist_songs.select_related(
        'song',
        'song__artist',
        'song__album',
        'song__album__artist'
    ).order_by('order', 'added_at')

    songs = [ps.song for ps in playlist_songs]
    liked_song_ids = set(
        Like.objects.filter(user=request.user, song__in=songs).values_list('song_id', flat=True)
    ) if songs else set()

    return render(request, 'music/playlist_detail.html', {
        'playlist': playlist,
        'songs': songs,
        'liked_song_ids': liked_song_ids,
        'total_count': len(songs),
    })


@login_required(login_url='login')
def add_to_playlist(request, playlist_id, song_id=None):
    """
    Add a song to a playlist.
    Enforces strict ownership: users can only add songs to their own playlists.
    Handles duplicate song addition gracefully without throwing a server error.
    Preserves PlaylistSong.order for sequential track indexing.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed. POST required.'}, status=405)

    playlist = get_object_or_404(Playlist, id=playlist_id, user=request.user)

    if song_id is None:
        song_id = request.POST.get('song_id')
        if not song_id and request.body:
            try:
                data = json.loads(request.body)
                song_id = data.get('song_id')
            except Exception:
                pass

    if not song_id:
        return JsonResponse({'error': 'Song ID is required.'}, status=400)

    song = get_object_or_404(Song, id=song_id)

    # Check for duplicate
    existing = PlaylistSong.objects.filter(playlist=playlist, song=song).first()
    if existing:
        return JsonResponse({
            'success': False,
            'already_exists': True,
            'message': f'"{song.title}" is already in "{playlist.name}".',
            'playlist_id': playlist.id,
            'playlist_name': playlist.name,
            'song_id': song.id,
            'song_title': song.title,
            'song_count': playlist.playlist_songs.count(),
        }, status=200)

    try:
        max_order = playlist.playlist_songs.aggregate(Max('order'))['order__max']
        next_order = (max_order + 1) if max_order is not None else 0

        PlaylistSong.objects.create(
            playlist=playlist,
            song=song,
            order=next_order
        )
        playlist.save(update_fields=['updated_at'])
    except IntegrityError:
        return JsonResponse({
            'success': False,
            'already_exists': True,
            'message': f'"{song.title}" is already in "{playlist.name}".',
            'playlist_id': playlist.id,
            'playlist_name': playlist.name,
            'song_id': song.id,
            'song_title': song.title,
            'song_count': playlist.playlist_songs.count(),
        }, status=200)

    if not request.headers.get('x-requested-with') and not (request.content_type and 'application/json' in request.content_type):
        referer = request.META.get('HTTP_REFERER')
        if referer:
            return redirect(referer)
        return redirect('playlist_detail', playlist_id=playlist.id)

    return JsonResponse({
        'success': True,
        'already_exists': False,
        'message': f'Added "{song.title}" to "{playlist.name}".',
        'playlist_id': playlist.id,
        'playlist_name': playlist.name,
        'song_id': song.id,
        'song_title': song.title,
        'song_count': playlist.playlist_songs.count(),
    }, status=201)


@login_required(login_url='login')
def remove_from_playlist(request, playlist_id, song_id=None):
    """
    Remove a song from a playlist.
    Enforces strict ownership: users can only remove songs from their own playlists.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed. POST required.'}, status=405)

    playlist = get_object_or_404(Playlist, id=playlist_id, user=request.user)

    if song_id is None:
        song_id = request.POST.get('song_id')
        if not song_id and request.body:
            try:
                data = json.loads(request.body)
                song_id = data.get('song_id')
            except Exception:
                pass

    if not song_id:
        return JsonResponse({'error': 'Song ID is required.'}, status=400)

    song = get_object_or_404(Song, id=song_id)

    playlist_song = PlaylistSong.objects.filter(playlist=playlist, song=song).first()
    if not playlist_song:
        return JsonResponse({
            'success': False,
            'message': f'"{song.title}" is not in "{playlist.name}".',
            'playlist_id': playlist.id,
            'song_id': song.id,
            'song_count': playlist.playlist_songs.count(),
        }, status=404)

    playlist_song.delete()
    playlist.save(update_fields=['updated_at'])

    if not request.headers.get('x-requested-with') and not (request.content_type and 'application/json' in request.content_type):
        referer = request.META.get('HTTP_REFERER')
        if referer:
            return redirect(referer)
        return redirect('playlist_detail', playlist_id=playlist.id)

    return JsonResponse({
        'success': True,
        'message': f'Removed "{song.title}" from "{playlist.name}".',
        'playlist_id': playlist.id,
        'playlist_name': playlist.name,
        'song_id': song.id,
        'song_title': song.title,
        'song_count': playlist.playlist_songs.count(),
    }, status=200)


@login_required(login_url='login')
def user_playlists_api(request):
    """
    Return JSON list of the current user's playlists for the Add to Playlist modal.
    Optional query parameter ?song_id=<id> marks playlists that already contain that song.
    """
    song_id = request.GET.get('song_id')
    playlists = Playlist.objects.filter(user=request.user).annotate(
        song_count=Count('playlist_songs')
    ).order_by('-updated_at')

    existing_playlist_ids = set()
    if song_id:
        try:
            existing_playlist_ids = set(
                PlaylistSong.objects.filter(
                    playlist__user=request.user,
                    song_id=int(song_id)
                ).values_list('playlist_id', flat=True)
            )
        except (ValueError, TypeError):
            pass

    data = [
        {
            'id': p.id,
            'name': p.name,
            'song_count': p.song_count,
            'cover_url': p.get_cover_url(),
            'has_song': p.id in existing_playlist_ids,
        }
        for p in playlists
    ]

    return JsonResponse({'playlists': data, 'total_count': len(data)}, status=200)


@login_required(login_url='login')
def edit_playlist(request, playlist_id):
    """
    Edit playlist details: name, description, preset artwork, or custom cover.
    Allows selecting any preset, uploading custom cover, or removing custom cover.
    Enforces strict ownership: users can only edit their own playlists.
    """
    playlist = get_object_or_404(Playlist, id=playlist_id, user=request.user)
    error = None
    selected_preset = playlist.preset_cover if playlist.preset_cover in VALID_PRESET_IDS else 'preset-1'
    name_value = playlist.name
    desc_value = playlist.description

    if request.method == 'POST':
        name_value = request.POST.get('name', '').strip()
        desc_value = request.POST.get('description', '').strip()
        preset_cover = request.POST.get('preset_cover', 'preset-1').strip()
        remove_custom = request.POST.get('remove_custom_cover') in ['true', '1', 'on']
        custom_cover = request.FILES.get('custom_cover')

        if preset_cover in VALID_PRESET_IDS:
            selected_preset = preset_cover

        if not name_value:
            error = 'Please enter a name for your playlist.'
        else:
            if preset_cover not in VALID_PRESET_IDS:
                preset_cover = 'preset-1'

            playlist.name = name_value
            playlist.description = desc_value
            playlist.preset_cover = preset_cover

            if custom_cover:
                playlist.custom_cover = custom_cover
            elif remove_custom:
                if playlist.custom_cover:
                    try:
                        playlist.custom_cover.delete(save=False)
                    except Exception:
                        pass
                playlist.custom_cover = None

            playlist.save()
            return redirect('playlist_detail', playlist_id=playlist.id)

    return render(request, 'music/edit_playlist.html', {
        'playlist': playlist,
        'presets': PRESET_COVERS,
        'default_preset': selected_preset,
        'has_custom_cover': bool(playlist.custom_cover),
        'error': error,
        'name_value': name_value,
        'desc_value': desc_value,
    })


@login_required(login_url='login')
def delete_playlist(request, playlist_id):
    """
    Delete a playlist owned by the authenticated user.
    PlaylistSong entries are deleted automatically via CASCADE relationship.
    Requires POST request with CSRF protection.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed. POST required.'}, status=405)

    playlist = get_object_or_404(Playlist, id=playlist_id, user=request.user)
    playlist_name = playlist.name
    playlist_id_val = playlist.id

    if playlist.custom_cover:
        try:
            playlist.custom_cover.delete(save=False)
        except Exception:
            pass

    playlist.delete()

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or (request.content_type and 'application/json' in request.content_type):
        return JsonResponse({
            'success': True,
            'message': f'Playlist "{playlist_name}" was deleted.',
            'playlist_id': playlist_id_val,
            'redirect_url': reverse('playlist_list'),
        }, status=200)

    return redirect('playlist_list')


@login_required(login_url='login')
def reorder_playlist_songs(request, playlist_id):
    """
    Reorder tracks in a playlist via drag-and-drop.
    Expects JSON payload with 'song_ids': [id1, id2, ...] in desired order.
    Validates submitted song IDs against existing playlist tracks.
    Rejects malformed payloads and foreign entries.
    Persists positions consistently using PlaylistSong.order.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed. POST required.'}, status=405)

    playlist = get_object_or_404(Playlist, id=playlist_id, user=request.user)

    song_ids = None
    if request.body:
        try:
            data = json.loads(request.body)
            song_ids = data.get('song_ids')
        except Exception:
            pass

    if song_ids is None:
        song_ids = request.POST.getlist('song_ids[]') or request.POST.getlist('song_ids')

    if not isinstance(song_ids, list):
        return JsonResponse({'error': 'Invalid payload format. Expected list of song IDs.'}, status=400)

    try:
        submitted_song_ids = [int(s) for s in song_ids]
    except (ValueError, TypeError):
        return JsonResponse({'error': 'All song IDs must be valid integers.'}, status=400)

    # Validate against actual playlist songs
    current_ps_map = {ps.song_id: ps for ps in playlist.playlist_songs.all()}
    current_song_ids = set(current_ps_map.keys())

    if len(current_song_ids) == 0:
        return JsonResponse({'success': True, 'message': 'Playlist is empty, no reorder needed.', 'order': []}, status=200)

    # Strict validation: submitted IDs must match playlist tracks exactly
    if set(submitted_song_ids) != current_song_ids or len(submitted_song_ids) != len(current_song_ids):
        return JsonResponse({
            'error': 'Submitted song list does not match playlist tracks. Foreign or missing tracks rejected.'
        }, status=400)

    with transaction.atomic():
        for index, s_id in enumerate(submitted_song_ids):
            ps = current_ps_map.get(s_id)
            if ps and ps.order != index:
                ps.order = index
                ps.save(update_fields=['order'])
        playlist.save(update_fields=['updated_at'])

    return JsonResponse({
        'success': True,
        'message': 'Track order updated successfully.',
        'playlist_id': playlist.id,
        'order': submitted_song_ids
    }, status=200)


@login_required(login_url='login')
def recently_played(request):
    """
    Display the authenticated user's recently played songs / listening history.
    Orders songs by most recently played.
    Deduplicates distinct songs while preserving the latest played timestamp.
    Handles empty history gracefully.
    """
    records = (
        ListeningHistory.objects.filter(user=request.user)
        .select_related('song', 'song__artist', 'song__album', 'song__album__artist')
        .order_by('-played_at')[:100]
    )

    seen_ids = set()
    recent_songs = []
    for r in records:
        if r.song_id not in seen_ids:
            seen_ids.add(r.song_id)
            r.song.last_played_at = r.played_at
            recent_songs.append(r.song)

    liked_song_ids = set()
    if recent_songs:
        liked_song_ids = set(
            Like.objects.filter(user=request.user, song__in=recent_songs).values_list('song_id', flat=True)
        )

    return render(request, 'music/recently_played.html', {
        'songs': recent_songs,
        'liked_song_ids': liked_song_ids,
        'total_count': len(recent_songs),
    })


def record_listen(request):
    """
    Record a song listening event in ListeningHistory for authenticated users.
    Requires POST request.
    Strictly forbids unauthenticated guests (returns 401 Unauthorized).
    Debounces duplicate requests for the same song within 30 seconds.
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'error': 'Authentication required. Please log in to record listening history.',
            'authenticated': False
        }, status=401)

    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    song_id = None
    audio_url = None
    if request.body:
        try:
            data = json.loads(request.body)
            song_id = data.get('song_id')
            audio_url = data.get('audio_url')
        except Exception:
            pass

    if not song_id:
        song_id = request.POST.get('song_id')
    if not audio_url:
        audio_url = request.POST.get('audio_url')

    song = None
    if song_id:
        try:
            song = Song.objects.select_related('artist', 'album').get(id=int(song_id))
        except (Song.DoesNotExist, ValueError, TypeError):
            song = None

    if not song and audio_url:
        clean_url = audio_url.split('?')[0].replace('/media/', '').lstrip('/')
        song = Song.objects.filter(audio_file__endswith=clean_url).select_related('artist', 'album').first()

    if not song:
        return JsonResponse({'error': 'Song not found.'}, status=404)

    # Server-side debounce: check if user already recorded this song in the last 30 seconds
    recent_threshold = timezone.now() - timedelta(seconds=30)
    existing_recent = ListeningHistory.objects.filter(
        user=request.user,
        song=song,
        played_at__gte=recent_threshold
    ).order_by('-played_at').first()

    if existing_recent:
        return JsonResponse({
            'success': True,
            'debounced': True,
            'message': f'"{song.title}" play was already recorded recently.',
            'history_id': existing_recent.id,
            'song_id': song.id,
            'song_title': song.title,
        }, status=200)

    history = ListeningHistory.objects.create(user=request.user, song=song)

    return JsonResponse({
        'success': True,
        'debounced': False,
        'message': f'Recorded play for "{song.title}".',
        'history_id': history.id,
        'song_id': song.id,
        'song_title': song.title,
        'played_at': history.played_at.isoformat(),
    }, status=201)


@login_required(login_url='login')
def clear_history(request):
    """
    Clear all listening history records for the authenticated user.
    Requires POST request with CSRF protection.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    deleted_count, _ = ListeningHistory.objects.filter(user=request.user).delete()

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or (request.content_type and 'application/json' in request.content_type):
        return JsonResponse({
            'success': True,
            'message': 'Listening history cleared successfully.',
            'deleted_count': deleted_count,
            'redirect_url': reverse('recently_played'),
        }, status=200)

    return redirect('recently_played')


@login_required(login_url='login')
def remove_from_history(request, song_id=None):
    """
    Remove listening history records for a specific song belonging to the authenticated user.
    Requires POST request with CSRF protection.
    Deletes only the user's ListeningHistory entries for this song, NOT the Song model,
    audio files, playlists, likes, or other users' history.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed. POST required.'}, status=405)

    if song_id is None:
        song_id = request.POST.get('song_id')
        if not song_id and request.body:
            try:
                data = json.loads(request.body)
                song_id = data.get('song_id')
            except Exception:
                pass

    if not song_id:
        return JsonResponse({'error': 'Song ID is required.'}, status=400)

    try:
        song_id = int(song_id)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Invalid song ID.'}, status=400)

    song = get_object_or_404(Song, id=song_id)

    deleted_count, _ = ListeningHistory.objects.filter(user=request.user, song=song).delete()

    remaining_unique_count = (
        ListeningHistory.objects.filter(user=request.user)
        .values('song_id')
        .distinct()
        .count()
    )

    if (
        request.headers.get('x-requested-with') == 'XMLHttpRequest'
        or (request.content_type and 'application/json' in request.content_type)
        or request.headers.get('X-Requested-With') == 'Haven-PJAX'
    ):
        return JsonResponse({
            'success': True,
            'message': f'Removed "{song.title}" from your listening history.',
            'song_id': song.id,
            'song_title': song.title,
            'deleted_count': deleted_count,
            'remaining_count': remaining_unique_count,
        }, status=200)

    referer = request.META.get('HTTP_REFERER')
    if referer:
        return redirect(referer)
    return redirect('recently_played')



@login_required(login_url='login')
def recently_played_api(request):
    """
    JSON API returning authenticated user's recently played songs list.
    """
    records = (
        ListeningHistory.objects.filter(user=request.user)
        .select_related('song', 'song__artist', 'song__album')
        .order_by('-played_at')[:50]
    )
    seen_ids = set()
    songs_data = []
    default_image = static('music/images/album-midnight-vibes.svg')

    for r in records:
        if r.song_id not in seen_ids:
            seen_ids.add(r.song_id)
            s = r.song
            cover_url = default_image
            if s.album and s.album.cover_image:
                cover_url = s.album.cover_image.url
            elif s.artist and s.artist.image:
                cover_url = s.artist.image.url

            songs_data.append({
                'id': s.id,
                'title': s.title,
                'artist': s.artist.name if s.artist else 'Unknown',
                'album': s.album.title if s.album else 'Single',
                'cover_url': cover_url,
                'audio_url': s.audio_file.url if s.audio_file else '',
                'last_played_at': r.played_at.isoformat(),
            })

    return JsonResponse({'songs': songs_data, 'total_count': len(songs_data)}, status=200)


def discover(request):
    """
    Discover page view for Haven music streaming application.
    Accessible to both guests and authenticated users.
    Displays:
    - Spotlight release (featured album)
    - Featured Artists
    - Popular & Essential Albums
    - Discover / Fresh Tracks (with persistent player controls)
    """
    albums = list(Album.objects.select_related('artist').all()[:16])
    artists = list(Artist.objects.all()[:12])
    songs = list(Song.objects.select_related('artist', 'album').all()[:25])

    # Spotlight album: pick first album with a cover, or first album
    featured_album = None
    if albums:
        featured_album = next((a for a in albums if a.cover_image), albums[0])

    liked_song_ids = set()
    followed_artist_ids = set()

    if request.user.is_authenticated:
        liked_song_ids = set(Like.objects.filter(user=request.user, song__in=songs).values_list('song_id', flat=True))
        followed_artist_ids = set(FollowedArtist.objects.filter(user=request.user, artist__in=artists).values_list('artist_id', flat=True))

    context = {
        'featured_album': featured_album,
        'albums': albums,
        'artists': artists,
        'songs': songs,
        'liked_song_ids': liked_song_ids,
        'followed_artist_ids': followed_artist_ids,
        'total_songs_count': Song.objects.count(),
        'total_albums_count': Album.objects.count(),
        'total_artists_count': Artist.objects.count(),
    }

    return render(request, 'music/discover.html', context)


def follow_artist(request, artist_id):
    """
    Explicitly follow an artist.
    Requires POST method and authenticated user.
    Idempotent: repeating the request guarantees the user remains following.
    """
    if not request.user.is_authenticated:
        if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
            return JsonResponse({'error': 'Authentication required. Please log in to follow artists.'}, status=401)
        return redirect(f"{reverse('login')}?next={request.path}")

    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required.'}, status=405)

    artist = get_object_or_404(Artist, id=artist_id)
    followed_obj, created = FollowedArtist.objects.get_or_create(user=request.user, artist=artist)
    follower_count = artist.followers.count()

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'action': 'follow',
            'followed': True,
            'artist_id': artist.id,
            'artist_name': artist.name,
            'follower_count': follower_count,
            'message': f"You are now following {artist.name}.",
        }, status=200)

    referer = request.META.get('HTTP_REFERER')
    return redirect(referer or reverse('artist_detail', args=[artist.id]))


def unfollow_artist(request, artist_id):
    """
    Explicitly unfollow an artist.
    Requires POST method and authenticated user.
    Idempotent: repeating the request guarantees the user is not following.
    """
    if not request.user.is_authenticated:
        if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
            return JsonResponse({'error': 'Authentication required. Please log in to unfollow artists.'}, status=401)
        return redirect(f"{reverse('login')}?next={request.path}")

    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required.'}, status=405)

    artist = get_object_or_404(Artist, id=artist_id)
    deleted_count, _ = FollowedArtist.objects.filter(user=request.user, artist=artist).delete()
    follower_count = artist.followers.count()

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'action': 'unfollow',
            'followed': False,
            'artist_id': artist.id,
            'artist_name': artist.name,
            'follower_count': follower_count,
            'message': f"Unfollowed {artist.name}.",
        }, status=200)

    referer = request.META.get('HTTP_REFERER')
    return redirect(referer or reverse('artist_detail', args=[artist.id]))


@login_required(login_url='login')
def followed_artists(request):
    """
    Page listing artists followed by the current authenticated user.
    Cross-user isolation: filters strictly by request.user.
    """
    follow_records = FollowedArtist.objects.filter(user=request.user).select_related('artist').order_by('-created_at')

    followed_list = []
    for follow in follow_records:
        artist = follow.artist
        album_count = artist.album_set.count()
        song_count = artist.song_set.count()
        followed_list.append({
            'artist': artist,
            'album_count': album_count,
            'song_count': song_count,
            'followed_at': follow.created_at,
        })

    context = {
        'followed_list': followed_list,
        'total_count': len(followed_list),
    }

    return render(request, 'music/followed_artists.html', context)


@login_required(login_url='login')
def user_profile(request):
    """
    My Profile view for the authenticated user.
    Displays user account information, profile avatar customization options,
    built-in avatar presets, and personal library statistics.
    """
    user = request.user
    profile, _ = UserProfile.objects.get_or_create(user=user)

    playlist_count = Playlist.objects.filter(user=user).count()
    liked_songs_count = Like.objects.filter(user=user).count()
    followed_artists_count = FollowedArtist.objects.filter(user=user).count()
    unique_played_count = (
        ListeningHistory.objects.filter(user=user)
        .values('song_id')
        .distinct()
        .count()
    )

    avatar_presets = [
        {'id': 'avatar-1', 'name': 'Neon Pulse', 'url': static('music/images/avatars/avatar-1.svg')},
        {'id': 'avatar-2', 'name': 'Cosmic Beat', 'url': static('music/images/avatars/avatar-2.svg')},
        {'id': 'avatar-3', 'name': 'Vinyl Groove', 'url': static('music/images/avatars/avatar-3.svg')},
        {'id': 'avatar-4', 'name': 'Aurora Melody', 'url': static('music/images/avatars/avatar-4.svg')},
        {'id': 'avatar-5', 'name': 'Solar Rhythm', 'url': static('music/images/avatars/avatar-5.svg')},
        {'id': 'avatar-6', 'name': 'Midnight Wave', 'url': static('music/images/avatars/avatar-6.svg')},
    ]

    context = {
        'profile_user': user,
        'user_profile': profile,
        'current_avatar_url': profile.get_avatar_url(),
        'current_preset': profile.avatar_preset if not profile.avatar_image else '',
        'has_custom_image': bool(profile.avatar_image),
        'avatar_presets': avatar_presets,
        'playlist_count': playlist_count,
        'liked_songs_count': liked_songs_count,
        'followed_artists_count': followed_artists_count,
        'unique_played_count': unique_played_count,
    }
    return render(request, 'music/profile.html', context)


@login_required(login_url='login')
def update_profile_avatar(request):
    """
    Handles saving avatar customization for the authenticated user.
    Supports:
    - Selecting a built-in avatar preset (avatar-1 to avatar-6)
    - Resetting to default avatar
    - Uploading a custom profile image (JPEG, PNG, WebP) up to 5 MB with strict content inspection
    User isolation: ensures users can only update their own profile avatar.
    Returns JSON on AJAX requests or redirects back to the profile page.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required.'}, status=405)

    user = request.user
    profile, _ = UserProfile.objects.get_or_create(user=user)
    is_ajax = (
        request.headers.get('x-requested-with') == 'XMLHttpRequest' or
        request.META.get('HTTP_X_REQUESTED_WITH') == 'XMLHttpRequest' or
        request.headers.get('X-Requested-With') == 'Haven-PJAX' or
        'application/json' in request.headers.get('accept', '') or
        request.content_type == 'application/json'
    )

    action = request.POST.get('action', '').strip()
    preset_choice = request.POST.get('avatar_preset', '').strip()
    uploaded_file = request.FILES.get('avatar_image')

    VALID_PRESETS = {'avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5', 'avatar-6'}

    # 1. Reset to default avatar
    if action == 'reset_default' or preset_choice == 'default':
        old_image = profile.avatar_image
        profile.avatar_image = None
        profile.avatar_preset = ''
        profile.save()

        # Delete previous uploaded custom image for this user only AFTER successful save
        if old_image:
            try:
                old_image.delete(save=False)
            except Exception:
                pass

        avatar_url = profile.get_avatar_url()
        if is_ajax:
            return JsonResponse({
                'success': True,
                'avatar_url': avatar_url,
                'is_default': True,
                'message': 'Profile picture reset to default.',
            }, status=200)
        messages.success(request, 'Profile picture reset to default.')
        return redirect('profile')

    # 2. Custom Image Upload
    if action == 'upload' or (uploaded_file and action != 'preset'):
        if not uploaded_file:
            err_msg = 'No image file was selected. Please choose an image to upload.'
            if is_ajax:
                return JsonResponse({'error': err_msg}, status=400)
            messages.error(request, err_msg)
            return redirect('profile')

        MAX_SIZE = 5 * 1024 * 1024  # 5 MB
        if uploaded_file.size > MAX_SIZE:
            err_msg = 'Image file exceeds the 5 MB maximum size limit.'
            if is_ajax:
                return JsonResponse({'error': err_msg}, status=400)
            messages.error(request, err_msg)
            return redirect('profile')

        # File extension check
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in {'.jpg', '.jpeg', '.png', '.webp'}:
            err_msg = 'Unsupported file format. Please upload a JPEG, PNG, or WebP image.'
            if is_ajax:
                return JsonResponse({'error': err_msg}, status=400)
            messages.error(request, err_msg)
            return redirect('profile')

        # Deep content verification using Pillow
        try:
            uploaded_file.seek(0)
            img = Image.open(uploaded_file)
            img.verify()
            format_upper = (img.format or '').upper()
            if format_upper not in {'JPEG', 'PNG', 'WEBP'}:
                err_msg = f'Unsupported image format ({format_upper}). Only JPEG, PNG, and WebP are allowed.'
                if is_ajax:
                    return JsonResponse({'error': err_msg}, status=400)
                messages.error(request, err_msg)
                return redirect('profile')
        except Exception:
            err_msg = 'Invalid image file. Please upload a valid image.'
            if is_ajax:
                return JsonResponse({'error': err_msg}, status=400)
            messages.error(request, err_msg)
            return redirect('profile')

        # Reset pointer for saving
        uploaded_file.seek(0)

        # Retain previous image reference
        old_image = profile.avatar_image

        # Save with safe filename for this user
        target_ext = 'jpg' if format_upper == 'JPEG' else format_upper.lower()
        safe_filename = f"user_{user.id}_{uuid.uuid4().hex[:10]}.{target_ext}"
        profile.avatar_image.save(safe_filename, uploaded_file, save=False)
        profile.avatar_preset = ''
        profile.save()

        # Delete previous uploaded custom image for this user only AFTER successful save
        if old_image and old_image != profile.avatar_image:
            try:
                old_image.delete(save=False)
            except Exception:
                pass

        avatar_url = profile.get_avatar_url()
        if is_ajax:
            return JsonResponse({
                'success': True,
                'avatar_url': avatar_url,
                'is_default': False,
                'message': 'Profile picture uploaded and updated successfully.',
            }, status=200)
        messages.success(request, 'Profile picture uploaded successfully.')
        return redirect('profile')

    # 3. Built-in Preset Selection
    if preset_choice in VALID_PRESETS:
        old_image = profile.avatar_image
        profile.avatar_image = None
        profile.avatar_preset = preset_choice
        profile.save()

        # Delete previous custom image for this user only AFTER successful save
        if old_image:
            try:
                old_image.delete(save=False)
            except Exception:
                pass

        avatar_url = profile.get_avatar_url()
        if is_ajax:
            return JsonResponse({
                'success': True,
                'avatar_url': avatar_url,
                'preset': preset_choice,
                'is_default': False,
                'message': 'Profile avatar updated successfully.',
            }, status=200)
        messages.success(request, 'Profile avatar updated successfully.')
        return redirect('profile')

    err_msg = 'Please select a valid avatar preset or upload an image file.'
    if is_ajax:
        return JsonResponse({'error': err_msg}, status=400)
    messages.error(request, err_msg)
    return redirect('profile')









