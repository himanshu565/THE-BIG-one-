"""add embedding to document_chunks

Revision ID: d9a2b3c4d5e6
Revises: c8f1e2a3b4c5
Create Date: 2026-11-17 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'c8f1e2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nullable embedding column to document_chunks."""
    with op.batch_alter_table('document_chunks', schema=None) as batch_op:
        batch_op.add_column(sa.Column('embedding', sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove embedding column from document_chunks."""
    with op.batch_alter_table('document_chunks', schema=None) as batch_op:
        batch_op.drop_column('embedding')
