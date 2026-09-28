from django.contrib import admin
from .models import Artist, Song, Album, Playlist, PlaylistSong, Like, ListeningHistory

admin.site.register(Artist)
admin.site.register(Song)
admin.site.register(Album)
admin.site.register(Playlist)
admin.site.register(PlaylistSong)
admin.site.register(Like)
admin.site.register(ListeningHistory)
