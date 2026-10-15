"""users.role：业务角色列（hr / interviewer）

Revision ID: a1b2c3d4e5f6
Revises: 094471d50767
Create Date: 2026-10-14 20:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '094471d50767'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('role', sa.String(length=20), nullable=False, server_default='hr'))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('role')
