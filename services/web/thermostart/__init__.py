import csv
from flask import Flask
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy

from thermostart.config import Config
from thermostart.events import socketio

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = "auth.login_page"
login_manager.login_message_category = "info"

def fill_db(app):
    with app.app_context():
        from .models import Location
        locations = Location.query.all()
        if not locations:
            with open('world_cities_location_table.csv', newline='') as csvfile:
                locationreader = csv.reader(csvfile, delimiter=';', quotechar='"')
                for row in locationreader:
                    location = Location()
                    location.id = row[0]
                    location.country = row[1]
                    location.city = row[2]
                    location.latitude = row[3]
                    location.longitude = row[4]
                    location.timezone = row[5]
                    db.session.add(location)
            db.session.commit()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app=app)
    login_manager.init_app(app=app)

    from thermostart.errors.handlers import errors  # noqa F401
    from thermostart.ui.routes import ui  # noqa F401
    from thermostart.main.routes import main  # noqa F401
    from thermostart.auth.routes import auth  # noqa F401
    from thermostart.ts.routes import ts  # noqa F401

    app.register_blueprint(main)
    app.register_blueprint(auth)
    app.register_blueprint(ui)
    app.register_blueprint(errors)
    app.register_blueprint(ts)

    socketio.init_app(app)

    return app
