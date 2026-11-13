import os

from datetime import timedelta
from dotenv import load_dotenv

BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
BASE_DIR = os.path.abspath(os.path.dirname(BACKEND_DIR))

load_dotenv(os.path.join(BASE_DIR, '.env'))


class Config:
    def __init__(self, freeze_dest="build"):
        self.FREEZER_DESTINATION = freeze_dest
        self.FREEZER_IGNORE_404_NOT_FOUND = True

    ABYSS_URL = os.environ.get("VITE_ABYSS_URL", "http://localhost")
    REACT_PORT = os.environ.get("VITE_PORT", None)

    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    if JWT_SECRET_KEY is None:
        raise Exception("A JWT secret key should be defined in env")

    JWT_TOKEN_LOCATION = "cookies"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
            hours=int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', 5)))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
            days=int(os.environ.get('JWT_REFRESH_TOKEN_EXPIRES', 30)))

    if REACT_PORT is not None:
        JWT_COOKIE_SAMESITE = "Lax"
        JWT_COOKIE_SECURE = False
    else:
        JWT_COOKIE_SAMESITE = "None"
        JWT_COOKIE_SECURE = True

    user_db = os.environ.get("POSTGRE_DB_USER", "")
    passwd_db = os.environ.get("POSTGRE_DB_PASSWD", "")

    if user_db != "" and passwd_db != "":
        user_db += ":" + passwd_db

    host_db = os.environ.get("POSTGRE_DB_HOST", "")
    port_db = os.environ.get("POSTGRE_DB_PORT", "")

    if host_db != "" and port_db != "":
        host_db += ":" + port_db

    if user_db != "" and host_db != "":
        address_db = user_db + "@" + host_db
    elif user_db != "" and host_db == "":
        address_db = user_db
    elif user_db == "" and host_db != "":
        address_db = host_db
    else:
        address_db = ""

    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    SQLALCHEMY_DATABASE_URI = ('postgresql://' + address_db + '/' +
                               os.environ.get("POSTGRE_DB_NAME", "flask_db"))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {
            "options": "-c timezone=utc"
        },
        "pool_size": int(os.environ.get("DB_POOL_SIZE", 8)),
        "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", 4)),
        "pool_timeout": int(os.environ.get("DB_POOL_TIMEOUT", 30)),
        "pool_recycle": int(os.environ.get("DB_POOL_RECYCLE", 1800)),
        "pool_pre_ping": True,
    }

    ABYSS_ADMIN_NAME = os.environ.get("ABYSS_ADMIN_NAME", "CORAIL")
    ABYSS_ADMIN_GROUP_NAME = os.environ.get(
            "ABYSS_ADMIN_GROUP_NAME", "Corail-lab")
    ABYSS_ADMIN_PASSWD = os.getenv("ABYSS_ADMIN_PASSWD")
    if ABYSS_ADMIN_PASSWD is None:
        raise Exception("An admin password should be defined in env")

    LEAGUES = [
            'plancton', 'crevette',
            'hippocampe', 'poisson',
            'tortue', 'dauphin',
            'narval', 'requin',
            'baleine', 'orque']

    MAX_PARALLEL_MATCH_STARTUP = int(
            os.environ.get("DEFAULT_MAX_PARALLEL_MATCH", 1))
    ARENA_STATE_STARTUP = int(os.environ.get("DEFAULT_ARENA_STATE", 0))
    RESET_ARENA_ON_START = os.environ.get("RESET_ARENA_ON_START", "1") == "1"

    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'student_agents')
    FIGHTS_FOLDER = os.path.join(BASE_DIR, 'playground')
    GAME_DIR = os.path.join(BASE_DIR, 'game')
    RUNNER_PATH = os.path.join(BASE_DIR, 'backend', 'runner.py')

    GROUPS_STATS_CACHE_TTL = int(
            os.environ.get("GROUPS_STATS_CACHE_TTL", 60))

    ALLOWED_EXTENSIONS = {'zip'}
    ALLOWED_MIME = {'application/zip', 'x-zip-compressed'}
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024

    AGENT_NAME_MAX_LENGTH = int(
            os.environ.get("VITE_AGENT_NAME_MAX_LENGTH", 45))

    DEBUG = False
