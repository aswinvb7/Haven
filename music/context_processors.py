"""
Context processors for the Haven music streaming application.
Provides global user profile and avatar URL context across templates.
"""

def user_profile_context(request):
    """
    Supplies the authenticated user's profile and active avatar URL
    to all rendered templates (navbar avatar, dropdown, and pages).
    """
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        try:
            profile = getattr(user, 'profile', None)
            if profile is None:
                from .models import UserProfile
                profile = UserProfile.objects.filter(user=user).first()
            if profile:
                return {
                    'user_profile': profile,
                    'user_avatar_url': profile.get_avatar_url(),
                }
        except Exception:
            pass
    from django.templatetags.static import static
    return {
        'user_profile': None,
        'user_avatar_url': static('music/images/avatars/default-avatar.png'),
    }
