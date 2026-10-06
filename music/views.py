from django.shortcuts import render, redirect, get_object_or_404
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
