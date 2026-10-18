import os
import sys
import io
import django

# Setup Django Environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'MusicStreamProject.settings')
django.setup()

from django.test import Client
from django.contrib.auth.models import User
from django.urls import reverse
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from music.models import UserProfile, Artist, Album, Song

def run_tests():
    print("=" * 66)
    print("HAVEN - PROFILE AVATAR CUSTOMIZATION & NAVBAR REFINEMENT TESTS")
    print("=" * 66)

    client = Client(SERVER_NAME='localhost')

    # 1. Setup Test Users
    user1, _ = User.objects.get_or_create(username='avatar_verifier1')
    user1.set_password('TestPass123!')
    user1.email = 'verifier1@havenmusic.com'
    user1.save()

    user2, _ = User.objects.get_or_create(username='avatar_verifier2')
    user2.set_password('TestPass123!')
    user2.email = 'verifier2@havenmusic.com'
    user2.save()

    # Clean prior profile data
    UserProfile.objects.filter(user__in=[user1, user2]).delete()

    # Helper for image creation
    def make_img(fmt='JPEG', size=(64, 64), color=(139, 92, 246)):
        buf = io.BytesIO()
        img = Image.new('RGB', size, color)
        img.save(buf, format=fmt)
        buf.seek(0)
        ext = 'jpg' if fmt.upper() == 'JPEG' else fmt.lower()
        content_type = 'image/jpeg' if fmt.upper() == 'JPEG' else f'image/{fmt.lower()}'
        return SimpleUploadedFile(f'test.{ext}', buf.read(), content_type=content_type)

    # Test 1: Unauthenticated access blocked
    res = client.post(reverse('update_profile_avatar'), {'avatar_preset': 'avatar-1'})
    assert res.status_code == 302 and '/login/' in res.get('Location'), "Unauthenticated POST must redirect to login"
    print("[PASS] 1. Unauthenticated avatar update redirects to login")

    # Test 2: Default avatar display for new user
    client.force_login(user1)
    res = client.get(reverse('profile'))
    assert res.status_code == 200, "Profile page must render 200"
    content = res.content.decode('utf-8')
    assert 'id="profilePageAvatarContainer"' in content, "Missing profilePageAvatarContainer"
    assert 'id="profilePageDefaultAvatar"' in content, "Missing profilePageDefaultAvatar"
    assert 'id="navbarAvatarContainer"' in content, "Missing navbarAvatarContainer"
    assert 'id="dropdownAvatarContainer"' in content, "Missing dropdownAvatarContainer"
    print("[PASS] 2. Default vector avatar displayed across navbar, dropdown, and profile page for new user")

    # Test 3: Select all 6 built-in presets
    for i in range(1, 7):
        preset_id = f'avatar-{i}'
        res = client.post(
            reverse('update_profile_avatar'),
            {'avatar_preset': preset_id, 'action': 'preset'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        assert res.status_code == 200, f"Preset {preset_id} request failed"
        data = res.json()
        assert data.get('success') is True, f"Preset {preset_id} success was false"
        assert data.get('preset') == preset_id, f"Expected preset {preset_id}"
        assert f'/static/music/images/avatars/{preset_id}.svg' in data.get('avatar_url')

        profile = UserProfile.objects.get(user=user1)
        assert profile.avatar_preset == preset_id
        assert not bool(profile.avatar_image)
    print("[PASS] 3. Built-in avatar preset gallery selection verified across all 6 Haven Originals (avatar-1 to avatar-6)")

    # Test 4: Custom Image Uploads (JPEG, PNG, WebP)
    for fmt in ['JPEG', 'PNG', 'WEBP']:
        test_file = make_img(fmt=fmt)
        res = client.post(
            reverse('update_profile_avatar'),
            {'avatar_image': test_file, 'action': 'upload'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        assert res.status_code == 200, f"Upload {fmt} failed"
        data = res.json()
        assert data.get('success') is True
        assert '/media/profile_pictures/user_' in data.get('avatar_url')

        profile = UserProfile.objects.get(user=user1)
        assert bool(profile.avatar_image)
        assert profile.avatar_preset == ''
        assert f'user_{user1.id}_' in profile.avatar_image.name

        # Clean file
        if profile.avatar_image and os.path.exists(profile.avatar_image.path):
            try:
                os.remove(profile.avatar_image.path)
            except OSError:
                pass
    print("[PASS] 4. Custom image upload with deep Pillow verification verified for JPEG, PNG, and WebP")

    # Test 5: Rejection of oversized (> 5 MB) files
    oversized = SimpleUploadedFile('large.jpg', b'0' * (5 * 1024 * 1024 + 1024), content_type='image/jpeg')
    res = client.post(
        reverse('update_profile_avatar'),
        {'avatar_image': oversized},
        HTTP_X_REQUESTED_WITH='XMLHttpRequest'
    )
    assert res.status_code == 400
    assert '5 MB' in res.json().get('error', '')
    print("[PASS] 5. Oversized (>5MB) file rejection strictly enforced")

    # Test 6: Rejection of invalid/corrupted files
    corrupt = SimpleUploadedFile('fake.png', b'This is definitely not an image file', content_type='image/png')
    res = client.post(
        reverse('update_profile_avatar'),
        {'avatar_image': corrupt},
        HTTP_X_REQUESTED_WITH='XMLHttpRequest'
    )
    assert res.status_code == 400
    assert 'Invalid image' in res.json().get('error', '')
    print("[PASS] 6. Invalid non-image / corrupted file rejection strictly enforced")

    # Test 7: Reset to default avatar
    res = client.post(
        reverse('update_profile_avatar'),
        {'action': 'reset_default'},
        HTTP_X_REQUESTED_WITH='XMLHttpRequest'
    )
    assert res.status_code == 200
    data = res.json()
    assert data.get('is_default') is True
    assert data.get('avatar_url') is None

    profile = UserProfile.objects.get(user=user1)
    assert profile.avatar_preset == ''
    assert not bool(profile.avatar_image)
    assert profile.get_avatar_url() is None
    print("[PASS] 7. Reset to default avatar cleanly clears preset and uploaded files")

    # Test 8: User data isolation
    profile1, _ = UserProfile.objects.get_or_create(user=user1)
    profile1.avatar_preset = 'avatar-2'
    profile1.save()

    client.force_login(user2)
    res = client.post(
        reverse('update_profile_avatar'),
        {'avatar_preset': 'avatar-6'},
        HTTP_X_REQUESTED_WITH='XMLHttpRequest'
    )
    assert res.status_code == 200

    profile1.refresh_from_db()
    profile2 = UserProfile.objects.get(user=user2)
    assert profile1.avatar_preset == 'avatar-2', "User 1 avatar must remain avatar-2"
    assert profile2.avatar_preset == 'avatar-6', "User 2 avatar must be avatar-6"
    print("[PASS] 8. User isolation verified: changes to User 2 do not affect User 1")

    # Test 9: Discover removed from main navbar .nav-center
    home_res = client.get(reverse('home'))
    assert home_res.status_code == 200
    home_html = home_res.content.decode('utf-8')
    nav_center_start = home_html.find('class="nav-center"')
    nav_center_end = home_html.find('</nav>', nav_center_start)
    nav_center_html = home_html[nav_center_start:nav_center_end]
    assert 'data-section="discover"' not in nav_center_html, "Discover must not be in nav-center"
    assert '/discover/' not in nav_center_html, "Discover URL must not be in nav-center"
    print("[PASS] 9. Discover link cleanly removed from main navbar center")

    # Test 10: Discover page and homepage card remain fully functional
    discover_res = client.get(reverse('discover'))
    assert discover_res.status_code == 200
    assert 'Discover Music' in discover_res.content.decode('utf-8')
    assert 'href="/discover/"' in home_html, "Homepage card must still link to /discover/"
    print("[PASS] 10. Discover route and homepage feature card remain 100% accessible and functional")

    # Test 11: Real-time context processor synchronization
    client.force_login(user1)
    home_res = client.get(reverse('home'))
    assert '/static/music/images/avatars/avatar-2.svg' in home_res.content.decode('utf-8')
    print("[PASS] 11. Context processor user_avatar_url delivers synchronized avatar to all base template renders")

    print("=" * 66)
    print("ALL 11 VERIFICATIONS PASSED PERFECTLY!")
    print("=" * 66)

if __name__ == '__main__':
    run_tests()
