"""create evaluations table

Revision ID: c8f1e2a3b4c5
Revises: f5eb10c9080e
Create Date: 2026-11-15 23:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f1e2a3b4c5'
down_revision: Union[str, Sequence[str], None] = 'f5eb10c9080e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to include evaluation_runs table."""
    op.create_table(
        'evaluation_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('latency_ms', sa.Integer(), nullable=False),
        sa.Column('chunks_found', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('mode', sa.String(length=50), nullable=False, server_default='hybrid'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Passed'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_evaluation_runs_project_id'), 'evaluation_runs', ['project_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_evaluation_runs_project_id'), table_name='evaluation_runs')
    op.drop_table('evaluation_runs')
