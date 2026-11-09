"""ensure indexes exist (idempotent, concurrent)

Revision ID: 9f3c2a7b1d4e
Revises: 8957ed7e5e21
Create Date: 2026-11-09 12:05:00.000000

Réconcilie les index pour deux cas :
* base fraîche : 365dd9b177b4 / 8957ed7e5e21 ont déjà créé les index
  (IF NOT EXISTS ne fait rien) ;
* base historique créée par l'ancien db.create_all() : aucun index,
  ils sont tous créés ici.

CREATE INDEX CONCURRENTLY évite de bloquer les écritures de l'arène.
ANALYZE rafraîchit les statistiques du planificateur (sans elles,
PostgreSQL peut continuer à choisir des scans séquentiels).

Si une création est interrompue, PostgreSQL laisse un index invalide :
    SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
    DROP INDEX CONCURRENTLY <nom>;
"""
from alembic import op

revision = "9f3c2a7b1d4e"
down_revision = "8957ed7e5e21"
branch_labels = None
depends_on = None

INDEXES = (
    ("ix_agent_group_id", "agent", "group_id"),
    ("ix_student_group_id", "student", "group_id"),
    ("ix_fight_player1_id", "fight", "player1_id"),
    ("ix_fight_player2_id", "fight", "player2_id"),
    ("ix_fight_winner_id", "fight", "winner_id"),
    ("ix_fight_status", "fight", "status"),
    ("ix_fight_date", "fight", "date"),
    ("ix_custom_stats_agent_id", "custom_stats", "agent_id"),
    ("ix_custom_stats_fight_id", "custom_stats", "fight_id"),
)


def upgrade():
    with op.get_context().autocommit_block():
        for name, table, column in INDEXES:
            op.execute(
                f'CREATE INDEX CONCURRENTLY IF NOT EXISTS "{name}" '
                f'ON "{table}" ("{column}")'
            )

    for table in ("agent", "student", "fight", "custom_stats"):
        op.execute(f'ANALYZE "{table}"')


def downgrade():
    pass
