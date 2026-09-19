import os
import logging
import uuid

from datetime import timezone, timedelta, datetime
from rlh import RedisPubSubLogHandler
from flask import Flask, current_app, request
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import (
        JWTManager, create_access_token,
        get_jwt_identity, get_jwt, set_access_cookies)
from flask_bcrypt import Bcrypt

from backend.config import Config
from backend.db import db
from backend.models.enums import FightStatusConverter

migrate = Migrate()
jwt = JWTManager()
bcrypt = Bcrypt()

def create_app(freeze=False, freeze_dest=None):
    app = Flask(__name__)

    config = None
    if freeze_dest is not None:
        config = Config(freeze_dest=freeze_dest)
    else:
        config = Config()

    app.config.from_object(config)
    
    # Setup logging
    if not os.path.exists('logs'):
        os.mkdir('logs')
    
    redis_handler = RedisPubSubLogHandler(channel_name="ABYSS_FLASK_LOGS",
                                fields=["msg", "module", "levelname", "process", "created"])
    redis_handler.setLevel(logging.INFO)


    redis_error_handler = RedisPubSubLogHandler(channel_name="ABYSS_FLASK_ERRORS",
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
    api.init_app(app,\
                 version='0.1',\
                 title='Abyss API',\
                 description='API for the Abyss project')
    
    origin = app.config["ABYSS_URL"] + (":"+app.config["REACT_PORT"] if app.config["REACT_PORT"] is not None else "")
    CORS(app, supports_credentials=True, resources={r"/*": {"origins": origin}})

    
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

    with app.app_context():
        from backend.models import Student, Arena, Group, Agent, CustomStats, Fight, GroupStatus  # noqa: F401

        if (not freeze):
            connected = False
            while not connected:
                try:
                    current_app.config["ABYSS_MANAGER"].connect()
                    connected = True
                except Exception as _:
                    pass
        
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
        

        if (not freeze):
            lock = current_app.config["ABYSS_MANAGER"].init_lock()
            with lock:
                done = current_app.config["ABYSS_MANAGER"].init_done()

                if not done.is_set():
                    db.create_all()
                    if db.session.query(Group).filter_by(id=1).first() is None:
                        admin_group = Group(
                            id=1, # type: ignore
                            name=current_app.config["ABYSS_ADMIN_GROUP_NAME"], # type: ignore
                            status=GroupStatus.ACTIVE # type: ignore
                        )

                        db.session.add(admin_group)
                        db.session.commit()


                    admin = db.session.query(Student).filter_by(id=1).first()
                    if admin is None:
                        admin = Student(
                            id=1, # type: ignore
                            group_id=1, # type: ignore
                            username=current_app.config["ABYSS_ADMIN_NAME"], # type: ignore
                            password= bcrypt.generate_password_hash(current_app.config["ABYSS_ADMIN_PASSWD"]).decode('utf-8'), # type: ignore
                            role="admin" # type: ignore
                        )

                        db.session.add(admin)
                        db.session.commit()

                    if current_app.config["ABYSS_ADMIN_NAME"] != admin.username:
                        admin.username = current_app.config["ABYSS_ADMIN_NAME"]

                    if not bcrypt.check_password_hash(admin.password, current_app.config["ABYSS_ADMIN_PASSWD"]):
                        admin.password = bcrypt.generate_password_hash(current_app.config["ABYSS_ADMIN_PASSWD"]).decode('utf-8')

                    arena = db.session.query(Arena).filter_by(id=True).first()
                    if arena is None:
                        arena = Arena(
                            id=True, # type: ignore
                            state=current_app.config["ARENA_STATE_STARTUP"], # type: ignore
                            parallel_match=current_app.config["REDIS"].get("abyss_parallel_match") # type: ignore
                        )

                        db.session.add(arena)
                        db.session.commit()

                    arena.state = current_app.config["ARENA_STATE_STARTUP"]
                    arena_state_event = current_app.config["ABYSS_MANAGER"].arena_state()
                    arena_state_event.set() if arena.state else arena_state_event.clear()
                    current_app.config["REDIS"].set("abyss_parallel_match", arena.parallel_match)

                    db.session.commit()

                    flask_state_event = current_app.config["ABYSS_MANAGER"].flask_state()
                    done.set()
                    flask_state_event.set()
                


    @jwt.token_in_blocklist_loader
    def check_if_token_is_revoked(jwt_header, jwt_payload: dict):
        jti = jwt_payload["jti"]
        token_in_redis = app.config["REDIS"].get(jti)
        return token_in_redis is not None
            
    return app
