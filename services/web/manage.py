from flask.cli import FlaskGroup

from thermostart import create_app, db, fill_db

app = create_app()
cli = FlaskGroup(app)


@cli.command("create_db")
def create_db():
    db.drop_all()
    db.create_all()
    db.session.commit()
    fill_db(app)


if __name__ == "__main__":
    cli()
