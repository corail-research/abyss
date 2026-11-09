"""
Schema update via Alembic.

Stamping older versions before Alembic with the revision prior indexes
"""
import os

from flask import Flask
from flask_migrate import stamp, upgrade
from sqlalchemy import inspect

from backend.db import db

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
MIGRATIONS_DIR = os.path.join(BASE_DIR, "migrations")

LEGACY_BASELINE = "8957ed7e5e21"


def ensure_schema(app: Flask) -> None:
    with app.app_context():
        tables = set(inspect(db.engine).get_table_names())

        if "alembic_version" not in tables and "fight" in tables:
            app.logger.warning(
                "Existing database with no Alembic history: stamping "
                "revision %s (keep tables, create missing indexes).",
                LEGACY_BASELINE,
            )
            stamp(directory=MIGRATIONS_DIR, revision=LEGACY_BASELINE)

        upgrade(directory=MIGRATIONS_DIR)
        app.logger.info("Database schema up to date (Alembic head).")
