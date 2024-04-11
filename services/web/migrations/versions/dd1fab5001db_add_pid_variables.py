"""Add PID variables.

Revision ID: dd1fab5001db
Revises: 26422f1f63d0
Create Date: 2024-04-06 22:15:01.581614

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "dd1fab5001db"
down_revision = "26422f1f63d0"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("device", schema=None) as batch_op:
        batch_op.alter_column(
            "measured_temperature",
            new_column_name="room_temperature",
            existing_type=sa.Integer(),
        )
        batch_op.alter_column(
            "set_temperature",
            new_column_name="target_temperature",
            existing_type=sa.Integer(),
        )
        batch_op.add_column(sa.Column("kp", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("ti", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("td", sa.Float(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("device", schema=None) as batch_op:
        batch_op.alter_column(
            "room_temperature",
            new_column_name="measured_temperature",
            existing_type=sa.Integer(),
        )
        batch_op.alter_column(
            "target_temperature",
            new_column_name="set_temperature",
            existing_type=sa.Integer(),
        )
        batch_op.drop_column("td")
        batch_op.drop_column("ti")
        batch_op.drop_column("kp")

    # ### end Alembic commands ###
