from flask_bcrypt import Bcrypt

from backend.db import db
from backend.models import Arena, Group, Student
from backend.models.enums import GroupStatus
from backend.runtime import set_arena_enabled

bcrypt = Bcrypt()


def seed_defaults(app) -> None:
    """Create admin group, admin student and Arena db config if absents."""
    with app.app_context():
        if db.session.get(Group, 1) is None:
            db.session.add(Group(
                id=1,
                name=app.config["ABYSS_ADMIN_GROUP_NAME"],
                status=GroupStatus.ACTIVE,
            ))
            db.session.commit()

        admin = db.session.get(Student, 1)
        if admin is None:
            admin = Student(
                id=1,
                group_id=1,
                username=app.config["ABYSS_ADMIN_NAME"],
                password=bcrypt.generate_password_hash(
                    app.config["ABYSS_ADMIN_PASSWD"]).decode("utf-8"),
                role="admin",
            )
            db.session.add(admin)
            db.session.commit()

        if admin.username != app.config["ABYSS_ADMIN_NAME"]:
            admin.username = app.config["ABYSS_ADMIN_NAME"]
        if not bcrypt.check_password_hash(
                admin.password, app.config["ABYSS_ADMIN_PASSWD"]):
            admin.password = bcrypt.generate_password_hash(
                app.config["ABYSS_ADMIN_PASSWD"]).decode("utf-8")

        arena = db.session.get(Arena, True)
        if arena is None:
            arena = Arena(
                id=True,
                state=bool(app.config["ARENA_STATE_STARTUP"]),
                parallel_match=app.config["MAX_PARALLEL_MATCH_STARTUP"],
            )
            db.session.add(arena)

        if app.config["RESET_ARENA_ON_START"]:
            arena.state = bool(app.config["ARENA_STATE_STARTUP"])

        db.session.commit()

        # Publish state for arena
        set_arena_enabled(app.config["REDIS"], arena.state)
