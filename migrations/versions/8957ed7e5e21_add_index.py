"""add index

Revision ID: 8957ed7e5e21
Revises: 365dd9b177b4
Create Date: 2026-11-09 11:16:41.319239

"""
from alembic import op
import sqlalchemy as sa


revision = '8957ed7e5e21'
down_revision = '365dd9b177b4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('custom_stats', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_custom_stats_agent_id'),
                              ['agent_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_custom_stats_fight_id'),
                              ['fight_id'], unique=False)

    with op.batch_alter_table('fight', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_fight_date'),
                              ['date'], unique=False)


def downgrade():
    with op.batch_alter_table('fight', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_fight_date'))

    with op.batch_alter_table('custom_stats', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_custom_stats_fight_id'))
        batch_op.drop_index(batch_op.f('ix_custom_stats_agent_id'))
