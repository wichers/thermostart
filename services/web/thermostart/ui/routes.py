from flask import Blueprint, jsonify, make_response, render_template, request
from flask_login import current_user, login_required

from thermostart import db
from thermostart.models import Device, Location
from thermostart.ts.utils import get_patched_firmware_by_hw_version

ui = Blueprint("ui", __name__)


@ui.route("/ui")
@login_required
def home():
    return render_template("ui.html")


@ui.route("/thermostatmodel")
@login_required
def thermostatmodel():
    return jsonify(
        exceptions=current_user.exceptions,
        room_temperature=current_user.room_temperature,
        outside_temperature=current_user.outside_temperature,
        outside_temperature_icon=None,
        predefined_temperatures=current_user.predefined_temperatures,
        predefined_labels=current_user.predefined_labels,
        target_temperature=current_user.target_temperature,
        standard_week=current_user.standard_week,
        source=current_user.source,
        ui_synced=current_user.ui_synced,
        ui_source=current_user.ui_source,
        ta=current_user.ta,
        dim=current_user.dim,
        locale=current_user.locale,
        host=current_user.host,
        port=current_user.port,
        sl=current_user.sl,
        sd=current_user.sd,
        dhw_programs=current_user.dhw_programs,
        fw=current_user.fw,
        hw=current_user.hw,
        utc_offset=current_user.utc_offset_in_seconds() / 3600,
        oo=current_user.oo,
        ot0=current_user.ot0,
        ot1=current_user.ot1,
        ot3=current_user.ot3,
        ot17=current_user.ot17,
        ot18=current_user.ot18,
        ot19=current_user.ot19,
        ot25=current_user.ot25,
        ot26=current_user.ot26,
        ot27=current_user.ot27,
        ot28=current_user.ot28,
        ot34=current_user.ot34,
        ot56=current_user.ot56,
        ot125=current_user.ot125,
    )


@ui.route("/firmware", methods=["POST"])
@login_required
def firmware():
    version = int(request.form["version"])

    data = get_patched_firmware_by_hw_version(
        version, current_user.host, current_user.port
    )

    response = make_response(data)
    response.headers.set("Content-Type", "text/plain")
    response.headers.set(
        "Content-Disposition", "attachment", filename=f"ts_firmware_hw{version}.hex"
    )
    return response
