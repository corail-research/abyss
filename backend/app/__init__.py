import os
import logging
import uuid

from datetime import timezone, timedelta, datetime
from rlh import RedisPubSubLogHandler
from flask import Flask, request
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import (
        JWTManager, create_access_token,
        get_jwt_identity, get_jwt, set_access_cookies)

from backend.db import db
from backend.config import Config
from backend.models.enums import FightStatusConverter
from backend.runtime import new_redis_client

migrate = Migrate()
jwt = JWTManager()

def create_app(freeze=False, freeze_dest=None):
    app = Flask(__name__)

    config = None
    if freeze_dest is not None:
        config = Config(freeze_dest=freeze_dest)
    else:
        config = Config()

    app.config.from_object(config)

    # Create redis client for app
    app.config["REDIS"] = new_redis_client(app.config["REDIS_URL"])

    # Setup logging
    if not os.path.exists('logs'):
        os.mkdir('logs')

    redis_handler = RedisPubSubLogHandler(
            channel_name="ABYSS_FLASK_LOGS",
            fields=["msg", "module", "levelname", "process", "created"])
    redis_handler.setLevel(logging.INFO)

    redis_error_handler = RedisPubSubLogHandler(
            channel_name="ABYSS_FLASK_ERRORS",
            fields=["msg", "module", "levelname", "process", "created"])
    redis_error_handler.setLevel(logging.ERROR)

    app.logger.addHandler(redis_handler)
    app.logger.addHandler(redis_error_handler)

    app.logger.setLevel(logging.INFO)
    app.logger.info('Abyss startup')

    app.url_map.converters.update(fight_status=FightStatusConverter)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    from .api import api
    api.init_app(app,
                 version='0.1',
                 title='Abyss API',
                 description='API for the Abyss project')

    origin = (app.config["ABYSS_URL"] +
              (":"+app.config["REACT_PORT"]
               if app.config["REACT_PORT"] is not None
               else ""))
    CORS(app, supports_credentials=True,
         resources={r"/*": {"origins": origin}})

    @app.after_request
    def handle_options(response):
        app.logger.info(f'User {request.remote_addr} requested {request.method} {request.url} - Response: {response.status_code}')
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With, X-CSRF-TOKEN, X-Fields"
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    @app.after_request
    def refresh_expiring_jwts(response):
        try:
            exp_timestamp = get_jwt()["exp"]
            now = datetime.now(timezone.utc)
            target_timestamp = datetime.timestamp(now + timedelta(minutes=5))
            if target_timestamp > exp_timestamp:
                access_token = create_access_token(identity=get_jwt_identity())
                set_access_cookies(response, access_token)
            return response
        except (RuntimeError, KeyError):
            return response

    from backend.models import (
            Student, Arena, Group, Agent, CustomStats, Fight, GroupStatus)  # noqa: F401

    @app.cli.command("seed")
    def seed_command():
        """Seed database (idempotent)."""
        from backend.bootstrap import seed_defaults
        seed_defaults(app)

    @app.cli.command("db-setup")
    def db_setup_command():
        """Apply Alembic migrations (on existing db)."""
        from backend.db_setup import ensure_schema
        ensure_schema(app)

    @app.errorhandler(400)
    def bad_request_error(e):
        app.logger.warning(f'Bad Request: {str(e)}')
        return 'Bad Request', 400

    @app.errorhandler(403)
    def forbidden_error(e):
        app.logger.warning(f'Forbidden: {str(e)}')
        return 'Forbidden', 403

    @app.errorhandler(404)
    def not_found_error(e):
        app.logger.warning(f'Not Found: {str(e)}')
        return 'Resource Not Found', 404

    @app.errorhandler(500)
    def internal_server_error(e):
        app.logger.error(f'Internal Server Error: {str(e)}', exc_info=True)
        return 'Internal Server Error', 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        error_id = uuid.uuid4()
        app.logger.critical(f'Unexpected Error {error_id}: {str(e)}', exc_info=True)
        return f'An unexpected error occurred. Please contact support with the following ID: {error_id}', 500

    @jwt.token_in_blocklist_loader
    def check_if_token_is_revoked(jwt_header, jwt_payload: dict):
        jti = jwt_payload["jti"]
        token_in_redis = app.config["REDIS"].get(jti)
        return token_in_redis is not None

    return app
