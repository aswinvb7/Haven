from django.shortcuts import render
from .models import Album, Artist


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

    # Curated sample artist data with realistic photographic portraits
    sample_artists = [
        {
            'name': 'Arijit Singh',
            'image': 'music/images/artist-arijit-singh.jpg',
        },
        {
            'name': 'Taylor Swift',
            'image': 'music/images/artist-taylor-swift.jpg',
        },
        {
            'name': 'The Weeknd',
            'image': 'music/images/artist-the-weeknd.jpg',
        },
        {
            'name': 'Dua Lipa',
            'image': 'music/images/artist-dua-lipa.jpg',
        },
        {
            'name': 'Ed Sheeran',
            'image': 'music/images/artist-ed-sheeran.jpg',
        },
        {
            'name': 'Billie Eilish',
            'image': 'music/images/artist-billie-eilish.jpg',
        },
    ]

    try:
        db_albums = list(Album.objects.select_related('artist').all()[:5])
        db_artists = list(Artist.objects.all()[:6])
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
