import calendar
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs

import requests
from flask import Blueprint, Response, jsonify, make_response, request
from flask_socketio import emit

from thermostart import db
from thermostart.models import Device, Location

from .utils import (
    Source,
    decrypt_request,
    encrypt_response,
    firmware_upgrade_needed,
    get_firmware,
)

_LOGGER = logging.getLogger(__name__)
ts = Blueprint("ts", __name__)

# tomorrow.io (weather) api key
TOMORROW_APIKEY = "gFUNhMZ2o4VotYhmcLrul3WYy7I2X9rN"


# WARNING: not to be used, needs reversing, web firmware is not working
@ts.route("/fw")
@ts.route("/fw/hcu")
def firmware_update():
    arg = str(next(iter(request.args)))
    arg = arg.split("_")
    hardware_id = arg[1]

    _LOGGER.info(
        "Got firmare request from %s with hardware id %s and request %s..",
        request.remote_addr,
        arg[1],
        arg[2][:20],
    )

    device = Device.query.get(hardware_id)
    if device is None:
        _LOGGER.warn(
            "Device with IP %s and hardware id %s is trying to communicate, but has not been registered.",
            request.remote_addr,
            arg[1],
        )
        return Response(response="no activated device", status=400)

    try:
        tsreq = decrypt_request(arg[2], device.password)
        tsreq = parse_qs(tsreq)
    except Exception:
        _LOGGER.warn(
            "Request from device with IP %s and hardware id %s cannot be decoded.",
            request.remote_addr,
            arg[1],
        )
        return Response(response="incorrect request", status=400)

    # validate decryption and url decoding
    if tsreq["p"][0] != device.password:
        return Response(response="password mismatch", status=400)

    hw = int(tsreq["hw"][0])

    _LOGGER.info(
        "Sending patched firmware to %s with hardware id %s, revision %d",
        request.remote_addr,
        arg[1],
        hw,
    )

    patch = {"hostname": device.host, "port": device.port, "replace_yourowl.com": True}
    data = get_firmware(hw, patch)
    data = encrypt_response(data, device.password)

    response = make_response(data)
    response.headers.set("Content-Type", "text/plain")
    return response


@ts.route("/api")
def api():
    """
    <CAL> -- Note that when returning a calendar the SPI Flash will wipe and rewrite, this causes wear on the flash device. Use this cautiously!
    vXXXX -- version (16bit calendar version)
    sDHHMMTTTW -- standard record: day, hour, minute, temperature, DHW (all in base10 ascii)
    xBBBBBBBBEEEEEEEETTTWX -- exception record: Begin of unix timestamp in UTC, Begin of unix timestamp in UTC, temperature (base10), DHW (base10), unused character
    bXXXY -- we don't use this, I think it has something to do with CAL time not being initialised and reverting to manual?
    </CAL> --
    <SVSET></SVSET> -- 50-250 # set temperature
    <BVSET></BVSET> -- 500-1000 # set outside temperature
    <PVSET></PVSET> -- floating point # sets measured temperature?
    <WEER/> -- - # unused markup tag
    <RMSG/> -- - # unused markup tag
    <TZ>+120</TZ> -- # Contains the (signed) time zone offset in minutes.
    <FW>1</FW> -- 0/1 # FW update
    <TA></TA> -- -25-25  # temperature adjustment/calibration
    <DIM></DIM> -- 0-100 # display dimming
    <SLS></SLS> -- 0-2 # status led setting:
                        0 = Status LED is off.
                        1 = Status LED displays only errors.
                        2 = Status LED glows on boiler activity, when new temperature is set and flashes to indicate errors (Default).
    <SD></SD> -- 0/1 # display function temperature or clock
    <PID>
    <KP>20.0</KP> -- The proportional term (Kp)
    <TI>600.0</TI> -- the integral term (Ti)
    <TD>-1.00</TD> -- differential term (Td)
    <FORCE></FORCE> -- <99 # ? manual temperature override?
    </PID>
    <LRN>
    <US></US> -- floating point # ?
    </LRN>
    <INIT>
    <SV></SV> -- -50-250 # ?
    <DHW>1</DHW> -- 0/1 # Domestic HOT Water on/off
    <SRC></SRC> -- 0-5 # CRASH: 0, MANUAL: 1, SERVER: 2, STD_WEEK: 3, EXCEPTION: 4, PAUSE: 5
    <LOCALE>nl-NL</LOCALE> -- de-DE, fr-FR, fr-BE, nl-NL, nl-BE, en-GB
    </INIT>
    <PAUSE>0</PAUSE> -- 0 or 1 # set home/away, Note this cannot be used in combination with init src
    <SRV></SRV> -- 1-255? # 1 will disable server communication?
    <TH></TH> -- 0-10 # The throttle factor property specifies the value of the server polling delay. A factor of 1 translates to delays of 10, 15, 20, 25, etc. seconds. A factor of 0 disables the throttling and defaults to 5 seconds.
    <TS></TS> -- 0 # Epoch time (GMT) in seconds
    """
    arg = str(next(iter(request.args)))
    arg = arg.split("_")
    hardware_id = arg[1]

    _LOGGER.info(
        "Got api request from %s with hardware id %s and request %s..",
        request.remote_addr,
        arg[1],
        arg[2][:20],
    )

    device = Device.query.get(hardware_id)
    if device is None:
        _LOGGER.warn(
            "Device with IP %s and hardware id %s is trying to communicate, but has not been registered.",
            request.remote_addr,
            arg[1],
        )
        return Response(response="no activated device", status=400)

    try:
        tsreq = decrypt_request(arg[2], device.password)
        tsreq = parse_qs(tsreq)
    except Exception:
        _LOGGER.warn(
            "Request from device with IP %s and hardware id %s cannot be decoded.",
            request.remote_addr,
            arg[1],
        )
        return Response(response="incorrect request", status=400)

    _LOGGER.info("Request %s:%s - %s", request.remote_addr, arg[1], tsreq | {"p": None})

    xml = "<ITHERMOSTAT>"

    if device.cal_synced is False:
        xml += "<CAL>"

        std_week = ""
        for block in device.standard_week:
            std_week = std_week + "s{:01d}{:02d}{:02d}{:03d}{:01d}".format(
                # Monday-Sunday (1-7)
                block["start"][0] + 1,
                block["start"][1],
                block["start"][2],
                device.predefined_temperatures[block["temperature"]],
                0,
            )

        exc_week = ""
        for block in device.exceptions:
            # month in javascript starts at 0, so increase by one
            start = datetime(
                block["start"][0],
                block["start"][1] + 1,
                block["start"][2],
                0,
                0,
                tzinfo=timezone(timedelta(seconds=-time.timezone)),
            )
            end = datetime(
                block["end"][0],
                block["end"][1] + 1,
                block["end"][2],
                0,
                0,
                tzinfo=timezone(timedelta(seconds=-time.timezone)),
            )
            # time in javascript implementation could start/end at 24, to not trigger an exception we use timedelta to add it
            start = start + timedelta(
                hours=block["start"][3], minutes=block["start"][4]
            )
            end = end + timedelta(hours=block["end"][3], minutes=block["end"][4])
            start = int(start.astimezone(timezone.utc).timestamp())
            end = int(end.astimezone(timezone.utc).timestamp())
            exc_week = exc_week + "x{:08X}{:08X}{:03d}{:01d}X".format(
                start, end, device.predefined_temperatures[block["temperature"]], 0
            )

        cal_version = device.cal_version + 1
        xml += "v{:04X}".format(cal_version & 0xFFFF)
        xml += std_week + exc_week
        xml += "</CAL>"

        device.cal_version = cal_version
        device.cal_synced = True
        db.session.commit()

    if int(tsreq["pv"][0]) != device.room_temperature:
        device.room_temperature = tsreq["pv"][0]
        db.session.commit()
        emit(
            "room_temperature",
            {"room_temperature": int(tsreq["pv"][0])},
            namespace="/",
            to=hardware_id,
        )

    if kp := tsreq.get("kp"):
        kp = float(kp[0])
        if kp != device.kp:
            device.kp = kp
            db.session.commit()

    if ti := tsreq.get("ti"):
        ti = float(ti[0])
        if ti != device.ti:
            device.ti = ti
            db.session.commit()

    if td := tsreq.get("td"):
        td = float(td[0])
        if td != device.td:
            device.td = td
            db.session.commit()

    if oo := tsreq.get("oo"):
        oo = int(oo[0])
        if oo != device.oo:
            device.oo = oo
            db.session.commit()

    otparams = [
        "ot0",
        "ot1",
        "ot3",
        "ot17",
        "ot18",
        "ot19",
        "ot25",
        "ot26",
        "ot27",
        "ot28",
        "ot34",
        "ot56",
        "ot125",
    ]
    otchanged = False
    for param in otparams:
        if param in tsreq:
            otvalue = int(tsreq[param][0], 16)
            if otvalue != 0xDEAD and otvalue != getattr(device, param):
                setattr(device, param, otvalue)
                otchanged = True
    if otchanged:
        db.session.commit()

    hw = int(tsreq["hw"][0])
    if hw != device.hw:
        hw = int(tsreq["hw"][0])
        device.hw = hw
        db.session.commit()

    if hw == 5:
        fw = int(tsreq["fw"][0][1:])
    else:
        fw = int(tsreq["fw"][0])
    if fw != device.fw:
        device.fw = fw
        db.session.commit()

    # TODO: further look into why firmware update process leaks and crashes
    # if firmware_upgrade_needed(hw, fw):
    #     xml += "<FW>1</FW>"

    if int(tsreq["pv"][0]) != device.room_temperature:
        device.room_temperature = tsreq["pv"][0]
        db.session.commit()
        emit(
            "room_temperature",
            {"room_temperature": int(tsreq["pv"][0])},
            namespace="/",
            to=hardware_id,
        )

    if (
        not device.outside_temperature_timestamp
        or datetime.fromtimestamp(device.outside_temperature_timestamp)
        + timedelta(seconds=3600)
        < datetime.utcnow()
    ):
        location = Location.query.filter_by(id=device.location_id).one()
        if location is None:
            return Response(response="no location", status=400)

        querystring = {
            "location": f"{location.latitude}, {location.longitude}",
            "apikey": TOMORROW_APIKEY,
        }
        url = "https://api.tomorrow.io/v4/weather/realtime"
        response = requests.request("GET", url, params=querystring)
        response = json.loads(response.text)
        outside_temperature = int(response["data"]["values"]["temperature"] * 10)

        xml += f"<BVSET>{outside_temperature}</BVSET>"
        emit(
            "outside_temperature",
            {
                "location": location.city,
                "outside_temperature": outside_temperature,
                "outside_temperature_icon": None,
            },
            namespace="/",
            to=hardware_id,
        )

        device.outside_temperature = outside_temperature
        device.outside_temperature_timestamp = calendar.timegm(time.gmtime())
        db.session.commit()

    # we need to initialize (device probably had a reboot)
    if "init" in tsreq:

        pause = int(device.source == Source.PAUSE.value)
        xml += f"<PAUSE>{pause}</PAUSE>"
        xml += (
            f"<INIT><SRC>{device.source}</SRC><LOCALE>{device.locale}</LOCALE></INIT>"
        )
        xml += f"<SVSET>{device.target_temperature}</SVSET>"
        xml += f"<BVSET>{device.outside_temperature}</BVSET>"
        xml += f"<TA>{device.ta}</TA>"
        xml += f"<DIM>{device.dim}</DIM>"
        xml += f"<SLS>{device.sl}</SLS>"
        xml += f"<SD>{device.sd}</SD>"
        xml += (
            f"<PID><KP>{device.kp}</KP><TI>{device.ti}</TI><TD>{device.td}</TD></PID>"
        )

    # is there a change from the webinterface?
    elif device.ui_synced is False:

        # somebody pressed pause?
        if device.ui_source == "pause_button":
            pause = int(device.source == Source.PAUSE.value)
            xml += f"<PAUSE>{pause}</PAUSE>"
            xml += f"<INIT><SRC>{device.source}</SRC></INIT>"
        elif (
            device.ui_source == "direct_temperature_setter_up"
            or device.ui_source == "direct_temperature_setter_down"
        ):
            xml += "<PAUSE>0</PAUSE>"
            xml += f"<INIT><SRC>{device.source}</SRC></INIT>"
            xml += f"<SVSET>{device.target_temperature}</SVSET>"
        else:
            xml += f"<TA>{device.ta}</TA>"
            xml += f"<DIM>{device.dim}</DIM>"
            xml += f"<INIT><LOCALE>{device.locale}</LOCALE></INIT>"
            xml += f"<SLS>{device.sl}</SLS>"
            xml += f"<SD>{device.sd}</SD>"

        # we have synced to the device
        device.ui_synced = True
        db.session.commit()

    elif "src" in tsreq:

        tssrc = int(tsreq["src"][0])

        # we're in manual (using TS interface) mode, communicate the manual temperature to our webinterface
        if (
            tssrc == Source.MANUAL.value
            and "csv" in tsreq
            and int(tsreq["csv"][0]) != device.target_temperature
        ):
            device.source = Source.MANUAL.value
            db.session.commit()
            emit(
                "target_temperature",
                {"target_temperature": int(tsreq["csv"][0])},
                namespace="/",
                to=hardware_id,
            )
            emit("source", {"source": tssrc}, namespace="/", to=hardware_id)

        elif tssrc == Source.CRASH.value:

            device.source = Source.STD_WEEK.value
            db.session.commit()

            xml += "<PAUSE>0</PAUSE>"
            xml += f"<INIT><SRC>{Source.STD_WEEK.value}</SRC></INIT>"

            emit(
                "source",
                {"source": Source.STD_WEEK.value},
                namespace="/",
                to=hardware_id,
            )

        elif tssrc != device.source:
            device.source = tssrc
            db.session.commit()

            # communicate new state to ui
            emit("source", {"source": tssrc}, namespace="/", to=hardware_id)

    updatetime = False
    if "ts" in tsreq:
        now = datetime.utcnow()
        ts_req = datetime.fromtimestamp(int(tsreq["ts"][0]))
        if ts_req + timedelta(seconds=60) > now or ts_req - timedelta(seconds=60) < now:
            updatetime = True
    else:
        updatetime = True

    if updatetime:
        # Time (GMT) in seconds
        xml += f"<TS>{calendar.timegm(time.gmtime())}</TS>"

    # time zone offset in minutes (signed).
    tz = device.utc_offset_in_seconds() / 60
    xml += f"<TZ>{tz}</TZ>"

    xml += "</ITHERMOSTAT>"

    _LOGGER.info("Response %s:%s - %s", request.remote_addr, arg[1], xml)

    data = encrypt_response(xml, device.password)
    return Response(response=data, status=200, mimetype="application/octet-stream")


@ts.route("/thermostat/<device_id>", methods=["GET", "POST"])
def thermostat(device_id):
    device = Device.query.get(device_id)
    if device is None:
        return Response(response="no activated device", status=400)
    if request.method == "GET":
        return jsonify(
            name=device.device_id,
            room_temperature=device.room_temperature,
            target_temperature=device.target_temperature,
            outside_temperature=device.outside_temperature,
            predefined_temperatures=device.predefined_temperatures,
            standard_week=device.standard_week,
            exceptions=device.exceptions,
            source=device.source,
            firmware=device.fw,
            ot={
                "enabled": device.oo,
                "raw": {
                    "ot0": device.ot0,
                    "ot1": device.ot1,
                    "ot3": device.ot3,
                    "ot17": device.ot17,
                    "ot18": device.ot18,
                    "ot19": device.ot19,
                    "ot25": device.ot25,
                    "ot26": device.ot26,
                    "ot27": device.ot27,
                    "ot28": device.ot28,
                    "ot34": device.ot34,
                    "ot56": device.ot56,
                    "ot125": device.ot125,
                },
            },
        )
    else:
        data = request.json

        if data.get("target_temperature"):
            device.target_temperature = data.get("target_temperature")

        if data.get("exceptions"):
            device.exceptions = data.get("exceptions")

        if data.get("standard_week"):
            device.standard_week = data.get("standard_week")

        if data.get("predefined_temperatures"):
            device.predefined_temperatures = data.get("predefined_temperatures")

        if data.get("outside_temperature"):
            device.outside_temperature = data.get("outside_temperature")

        if data.get("room_temperature"):
            device.room_temperature = data.get("room_temperature")

        if data.get("pause"):
            device.room_temperature = data.get("pause")
            device.ui_synced = False
            device.ui_source = "pause_button"
            device.source = Source.PAUSE.value

        device.commit()

    return Response(response="invalid method", status=400)
