import os

from engineio.async_drivers import eventlet
from flaskwebgui import FlaskUI

from thermostart import create_app, db, fill_location, socketio

app = create_app()


def create_db():
    dbfile = os.getenv("DATABASE_PATH")
    os.makedirs(os.getenv("LOCALAPPDATA") + "/thermostart/", exist_ok=True)
    if not os.path.isfile(dbfile):
        with app.app_context():
            db.drop_all()
            db.create_all()
            db.session.commit()
            fill_location(app)


def start_flask(**server_kwargs):
    server_kwargs["flask_socketio"].run(
        server_kwargs["app"], port=server_kwargs["port"], host=server_kwargs["host"]
    )


if __name__ == "__main__":
    FlaskUI(
        app=app,
        on_startup=create_db,
        server=start_flask,
        server_kwargs={
            "app": app,
            "port": 3888,
            "host": "0.0.0.0",
            "flask_socketio": socketio,
        },
        width=1024,
        height=800,
    ).run()
