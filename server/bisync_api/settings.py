"""
Django settings for the Bisync.cloud Python (Django REST Framework) backend.

This backend is a Python port of the ASP.NET Core API. It reads/writes the same
SQLite database that the .NET app seeds (via EF Core), mapping the existing
tables through unmanaged models, and serves the same `/api/*` contract the React
client expects on port 5299.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

# The SQLite database created and seeded by the .NET API. Overridable via env.
DB_PATH = os.environ.get(
    "BISYNC_DB_PATH",
    str(REPO_ROOT / "src" / "Bisync.Api" / "bisync.db"),
)

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "dev-only-insecure-key-change-in-production"
)

DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() != "false"

ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "corsheaders",
    "rest_framework",
    "core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "bisync_api.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    },
]

WSGI_APPLICATION = "bisync_api.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DB_PATH,
    }
}

# All models map to pre-existing tables (managed=False); no Django-owned tables.
DATABASE_ROUTERS = []

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "UNAUTHENTICATED_USER": None,
}

# Dev CORS: the Vite client also proxies /api, but allow direct calls too.
CORS_ALLOW_ALL_ORIGINS = True

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
