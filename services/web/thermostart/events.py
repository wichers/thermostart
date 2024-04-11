from flask_login import current_user
from flask_socketio import SocketIO, join_room, leave_room

socketio = SocketIO(cors_allowed_origins="*", logger=True)


@socketio.on("store-thermostat", namespace="/")
def on_store_thermostat(req):
    from thermostart import db
    from thermostart.models import Device

    device = Device.query.get(current_user.get_id())
    device.exceptions = req["exceptions"]
    device.predefined_temperatures = req["predefined_temperatures"]
    device.predefined_labels = req["predefined_labels"]
    device.standard_week = req["standard_week"]
    device.dhw_programs = req["dhw_programs"]
    device.ta = req["ta"]
    device.dim = req["dim"]
    device.sl = req["sl"]
    device.sd = req["sd"]
    device.locale = req["locale"]
    device.host = req["host"]
    device.port = req["port"]
    device.source = req["source"]
    device.target_temperature = req["target_temperature"]
    device.ui_synced = req["ui_synced"]
    device.ui_source = req["ui_source"]
    device.cal_synced = False
    db.session.commit()


@socketio.on("connect")
def on_join():
    join_room(current_user.get_id())


@socketio.on("disconnect")
def on_leave():
    leave_room(current_user.get_id())
