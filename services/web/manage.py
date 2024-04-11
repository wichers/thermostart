import sys

from flask.cli import FlaskGroup

from thermostart import create_app, db, fill_location_db, has_alembic_version_in_db

app = create_app()
cli = FlaskGroup(app)


@cli.command("fill_db")
def fill_db():
    fill_location_db(app)


@cli.command("has_alembic_version")
def has_alembic_version():
    sys.exit(int(has_alembic_version_in_db()))


if __name__ == "__main__":
    cli()
