from django.db import models
from django.contrib.auth.models import User


class Artist(models.Model):
    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to='artist_images/', blank=True, null=True)

    def __str__(self):
        return self.name

class Album(models.Model):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE)
    cover_image = models.ImageField(upload_to='album_covers/', blank=True, null=True)

    def __str__(self):
        return self.title

class Song(models.Model):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE)
    album = models.ForeignKey(Album, on_delete=models.SET_NULL, null=True, blank=True)
    audio_file = models.FileField(upload_to='songs/')

    def __str__(self):
        return self.title

class Playlist(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='playlists')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    custom_cover = models.ImageField(upload_to='playlist_covers/', blank=True, null=True)
    preset_cover = models.CharField(max_length=50, default='preset-1', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.name

    def get_cover_url(self):
        if self.custom_cover:
            try:
                return self.custom_cover.url
            except Exception:
                pass
        valid_presets = {'preset-1', 'preset-2', 'preset-3', 'preset-4', 'preset-5', 'preset-6'}
        preset = self.preset_cover if self.preset_cover in valid_presets else 'preset-1'
        from django.templatetags.static import static
        return static(f'music/images/presets/{preset}.svg')


class PlaylistSong(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name='playlist_songs')
    song = models.ForeignKey(Song, on_delete=models.CASCADE, related_name='playlist_songs')
    order = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'added_at']
        constraints = [
            models.UniqueConstraint(fields=['playlist', 'song'], name='unique_playlist_song')
        ]

    def __str__(self):
        return f"{self.playlist.name} - {self.song.title}"


class Like(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    song = models.ForeignKey(Song, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.song.title}"


class ListeningHistory(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    song = models.ForeignKey(Song, on_delete=models.CASCADE)
    played_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.song.title}"


class FollowedArtist(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='followed_artists')
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE, related_name='followers')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'artist'], name='unique_user_artist_follow')
        ]

    def __str__(self):
        return f"{self.user.username} follows {self.artist.name}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar_preset = models.CharField(max_length=50, blank=True, default='')
    avatar_image = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"{self.user.username}'s Profile"

    def get_avatar_url(self):
        if self.avatar_image:
            try:
                return self.avatar_image.url
            except Exception:
                pass
        valid_presets = {'avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5', 'avatar-6'}
        if self.avatar_preset and self.avatar_preset in valid_presets:
            from django.templatetags.static import static
            return static(f'music/images/avatars/{self.avatar_preset}.svg')
        from django.templatetags.static import static
        return static('music/images/avatars/default-avatar.png')

    def is_default_avatar(self):
        return not bool(self.avatar_image) and not bool(self.avatar_preset)
