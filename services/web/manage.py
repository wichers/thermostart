import sys

from flask.cli import FlaskGroup

from thermostart import create_app, db, fill_location_db, needs_alembic_version_in_db

app = create_app()
cli = FlaskGroup(app)


@cli.command("fill_db")
def fill_db():
    fill_location_db(app)


@cli.command("needs_alembic_version")
def needs_alembic_version():
    sys.exit(int(needs_alembic_version_in_db()))


if __name__ == "__main__":
    cli()
