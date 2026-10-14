from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Q
from django.contrib.auth import logout
from .models import Album, Artist, Song
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login

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

    context = {
        'albums': albums,
        'artists': artists,
    }
    return render(request, 'music/home.html', context)


def album_detail(request, album_id):
    album = get_object_or_404(Album, id=album_id)
    songs = Song.objects.filter(album=album)

    context = {
        'album': album,
        'songs': songs,
    }

    return render(request, 'music/album_detail.html', context)


def artist_detail(request, artist_id):
    """
    Dedicated Artist Detail view for Haven music streaming application.
    Displays the artist's profile, discography (albums), and songs.
    """
    artist = get_object_or_404(Artist, id=artist_id)
    albums = Album.objects.filter(artist=artist)
    songs = Song.objects.filter(artist=artist).select_related('album', 'artist')

    context = {
        'artist': artist,
        'albums': albums,
        'songs': songs,
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
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')

        if password != confirm_password:
            return render(request, 'music/signup.html', {
                'error': 'Passwords do not match.'
            })

        if User.objects.filter(username=username).exists():
            return render(request, 'music/signup.html', {
                'error': 'Username already exists.'
            })

        User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        return redirect('home')

    return render(request, 'music/signup.html')



def user_login(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect('home')

        return render(request, 'music/login.html', {
            'error': 'Invalid username or password.'
        })

    return render(request, 'music/login.html')
