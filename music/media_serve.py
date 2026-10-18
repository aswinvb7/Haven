"""
Media serving view with HTTP 206 Partial Content and Byte-Range request support.
Optimized for streaming audio and video files in development.
"""
import os
import re
import posixpath
import mimetypes
from pathlib import Path

from django.http import HttpResponse, StreamingHttpResponse, Http404, HttpResponseNotModified, HttpResponseForbidden
from django.utils.http import http_date, parse_http_date
from django.utils._os import safe_join


def file_chunk_generator(file_path, offset, length, chunk_size=65536):
    """
    Yields chunks of a file starting from offset up to length bytes.
    """
    with open(file_path, 'rb') as f:
        f.seek(offset)
        bytes_remaining = length
        while bytes_remaining > 0:
            read_len = min(bytes_remaining, chunk_size)
            chunk = f.read(read_len)
            if not chunk:
                break
            bytes_remaining -= len(chunk)
            yield chunk


def ranged_serve(request, path, document_root=None):
    """
    Serve static media files with full HTTP Byte-Range support (RFC 7233).
    Returns:
      - 403 Forbidden if unauthenticated guest requests protected audio
      - 200 OK with 'Accept-Ranges: bytes' for standard requests
      - 206 Partial Content with 'Content-Range' for valid range requests
      - 416 Range Not Satisfiable for out-of-bounds requests
      - 304 Not Modified for conditional GET (If-Modified-Since)
      - 404 Not Found if the file does not exist
    """
    clean_path = posixpath.normpath(path).lstrip('/')
    fullpath = Path(safe_join(document_root, clean_path))

    if not fullpath.exists() or fullpath.is_dir():
        raise Http404(f"Media file not found: {path}")

    # Enforce authentication for protected audio files (songs) while keeping artwork public
    AUDIO_EXTENSIONS = {'.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus', '.wma', '.alac'}
    content_type, encoding = mimetypes.guess_type(str(fullpath))
    content_type = content_type or "application/octet-stream"

    is_audio = (
        clean_path.startswith('songs/') or
        clean_path.startswith('songs\\') or
        fullpath.suffix.lower() in AUDIO_EXTENSIONS or
        content_type.startswith('audio/')
    )

    if is_audio:
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return HttpResponseForbidden("Please log in to listen to music.")

    statobj = fullpath.stat()
    size = statobj.st_size
    mtime = statobj.st_mtime

    # Conditional GET check (If-Modified-Since)
    if_modified_since = request.headers.get('If-Modified-Since') or request.META.get('HTTP_IF_MODIFIED_SINCE')
    if if_modified_since:
        try:
            header_mtime = parse_http_date(if_modified_since)
            if int(mtime) <= int(header_mtime):
                return HttpResponseNotModified()
        except Exception:
            pass

    content_type, encoding = mimetypes.guess_type(str(fullpath))
    content_type = content_type or "application/octet-stream"
    filename = fullpath.name

    range_header = request.headers.get('Range') or request.META.get('HTTP_RANGE')

    # Standard non-range request
    if not range_header:
        resp = StreamingHttpResponse(
            file_chunk_generator(str(fullpath), 0, size),
            content_type=content_type,
            status=200
        )
        resp.headers['Content-Length'] = str(size)
        resp.headers['Accept-Ranges'] = 'bytes'
        resp.headers['Last-Modified'] = http_date(mtime)
        resp.headers['Content-Disposition'] = f'inline; filename="{filename}"'
        if encoding:
            resp.headers['Content-Encoding'] = encoding
        return resp

    # Parse byte range request (e.g., 'bytes=1000000-', 'bytes=100-200', 'bytes=-500')
    range_match = re.match(r'^bytes=(\d*)-(\d*)$', range_header.strip())
    if not range_match:
        # Unsupported format (e.g., multiple multipart ranges): fallback to full file
        resp = StreamingHttpResponse(
            file_chunk_generator(str(fullpath), 0, size),
            content_type=content_type,
            status=200
        )
        resp.headers['Content-Length'] = str(size)
        resp.headers['Accept-Ranges'] = 'bytes'
        resp.headers['Last-Modified'] = http_date(mtime)
        return resp

    first_byte, last_byte = range_match.groups()

    if first_byte and last_byte:
        start = int(first_byte)
        end = int(last_byte)
    elif first_byte:
        start = int(first_byte)
        end = size - 1
    elif last_byte:
        suffix_len = int(last_byte)
        start = max(0, size - suffix_len)
        end = size - 1
    else:
        start = 0
        end = size - 1

    # Out of bounds range check
    if start >= size or start > end or start < 0:
        resp = HttpResponse(status=416)
        resp.headers['Content-Range'] = f'bytes */{size}'
        resp.headers['Accept-Ranges'] = 'bytes'
        return resp

    if end >= size:
        end = size - 1

    length = end - start + 1

    resp = StreamingHttpResponse(
        file_chunk_generator(str(fullpath), start, length),
        content_type=content_type,
        status=206
    )
    resp.headers['Content-Range'] = f'bytes {start}-{end}/{size}'
    resp.headers['Content-Length'] = str(length)
    resp.headers['Accept-Ranges'] = 'bytes'
    resp.headers['Last-Modified'] = http_date(mtime)
    resp.headers['Content-Disposition'] = f'inline; filename="{filename}"'
    if encoding:
        resp.headers['Content-Encoding'] = encoding
    return resp
