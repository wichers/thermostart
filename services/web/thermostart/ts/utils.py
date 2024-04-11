import base64
import os
from binascii import hexlify
from enum import Enum

from Crypto.Cipher import ARC4
from intelhex import HexReaderError, IntelHex


class Source(Enum):
    CRASH = 0
    MANUAL = 1
    SERVER = 2
    STD_WEEK = 3
    EXCEPTION = 4
    PAUSE = 5


class Display(Enum):
    TEMPERATURE = 0
    CLOCK = 1


class StatusLed(Enum):
    OFF = 0
    ERRORS_ONLY = 1
    ENABLED = 2


TS_MASTER_KEY = "MR1FGUGSq0YLnZpI2kjABw=="

FIRMWARE_VERSIONS = [
    None,
    {"hw": 1, "sw": 20141018},
    {"hw": 2, "sw": 30020018},
    {"hw": 3, "sw": 30030030},
    {"hw": 4, "sw": 30040043},
    {"hw": 5, "sw": 30050046},
]
UPGRADED_VERSION_MINOR = 101


def firmware_upgrade_needed(hw, fw):
    if hw < 5:
        return False
    return next(
        item
        for item in FIRMWARE_VERSIONS
        if item["sw"] + UPGRADED_VERSION_MINOR != fw and item["hw"] == hw
    )


def decrypt_request(request, passwd):
    tempkey = passwd + TS_MASTER_KEY[len(passwd) :]
    arc4 = ARC4.new(tempkey.encode())
    blob = arc4.decrypt(base64.b16decode(request))
    # v5 appears to be having 0xff padding bytes at the end, we strip these
    blob = blob.strip(b"\xff")
    try:
        return blob.decode()
    except UnicodeDecodeError:
        raise Exception("incorrect request or password")


def encrypt_response(response, passwd):
    tempkey = passwd + TS_MASTER_KEY[len(passwd) :]
    arc4 = ARC4.new(tempkey.encode())
    response = arc4.encrypt(response.encode())
    # HW5 needs lowercase hex
    return base64.b16encode(response).lower()


def patchfirmware(h: IntelHex, hw, patch):
    # offsets as displayed in IDA need to be multiplied by 2

    # Patch #1: we patch the version number
    if version := patch.get("version"):
        if hw == 1:
            addr_lo = 0x1E0F8 * 2
            addr_hi = 0x1E0FA * 2

            assert h.gets(addr_lo, 4) == b"\xa0\x3d\x25\x00"  # MOV      #0x53DA, W0
            assert h.gets(addr_hi, 4) == b"\x31\x13\x20\x00"  # MOV      #0x133, W1
        elif hw == 2:
            addr_lo = 0x1CC9E * 2
            addr_hi = 0x1CCA0 * 2

            assert h.gets(addr_lo, 4) == b"\x20\x1b\x21\x00"  # MOV      #0x11B2, W0
            assert h.gets(addr_hi, 4) == b"\xa1\x1c\x20\x00"  # MOV      #0x1CA, W1
        elif hw == 3:
            addr_lo = 0x1D728 * 2
            addr_hi = 0x1D72A * 2

            assert h.gets(addr_lo, 4) == b"\xe0\x8c\x23\x00"  # MOV      #0x38CE, W0
            assert h.gets(addr_hi, 4) == b"\xa1\x1c\x20\x00"  # MOV      #0x1CA, W1
        elif hw == 4:
            addr_lo = 0x1D7CC * 2
            addr_hi = 0x1D7CE * 2

            assert h.gets(addr_lo, 4) == b"\xb0\xfe\x25\x00"  # MOV      #0x5FEB, W0
            assert h.gets(addr_hi, 4) == b"\xa1\x1c\x20\x00"  # MOV      #0x1CA, W1
        elif hw == 5:
            addr_lo = 0x106E8 * 2
            addr_hi = 0x106EA * 2

            assert h.gets(addr_lo, 4) == b"\xe0\x6f\x28\x00"  # MOV      #0x86FE, W0
            assert h.gets(addr_hi, 4) == b"\xa1\x1c\x20\x00"  # MOV      #0x1CA, W1

        version_lo = version & 0xFFFF
        version_hi = version >> 16

        mnemonic = 2 << 20 | version_lo << 4 | 0
        mnemonic = mnemonic.to_bytes(4, "little")
        h.puts(addr_lo, mnemonic)

        mnemonic = 2 << 20 | version_hi << 4 | 1
        mnemonic = mnemonic.to_bytes(4, "little")
        h.puts(addr_hi, mnemonic)

    # Patch #2: we are going to replace hw.thermosmart.nl with our own hostname
    # The new hostname will be put in an empty location within reach of the
    # original string table.
    if hostname := patch.get("hostname"):
        if isinstance(hostname, str):
            hostname = hostname.encode("ascii")

        # add zero termination
        hostname += b"\0"

        if hw == 5:
            hostname_offset = 0x26FF6

            # we patch the following three locations referencing hw.thermosmart.nl
            offsets = [0xA6DE * 2, 0xAE68 * 2, 0xCF66 * 2]
            for addr in offsets:
                assert h.gets(addr, 4) == b"\x80\xd0\x2d\x00"
                mnemonic = (
                    2 << 20 | (~(0x28000 - hostname_offset - 1) & 0xFFFF) << 4 | 0
                )
                mnemonic = mnemonic.to_bytes(4, "little")
                h.puts(addr, mnemonic)

        else:
            # In order to put our hostname in ROM we need to change the TCPOpen
            # parameter from TCP_OPEN_RAM_HOST (1) to TCP_OPEN_ROM_HOST (2)
            if hw == 1:
                offsets = [0xD77E * 2, 0xE1E2 * 2]
            elif hw == 2:
                offsets = [0x9FD2 * 2, 0xA8FA * 2]
            elif hw == 3:
                offsets = [0xA0D6 * 2, 0xAA08 * 2]
            elif hw == 4:
                offsets = [0xA13E * 2, 0xAAA4 * 2]

            for addr in offsets:
                assert h.gets(addr, 4) == b"\x12\xC0\xB3\x00"  # MOV.B    #1, W2
                h.puts(addr, b"\x22\xC0\xB3\x00")  # MOV.B    #2, W2

            # We replace RAM offsets with ROM offsets
            # MOV #0xXXXX, W0 and MOV #0xXXXX, W1
            if hw == 1:
                offsets = [
                    (0xD780 * 2, b"\x50\x95\x22\x00", 0xDD6E * 2, b"\x51\x95\x22\x00"),
                    (0xE1E4 * 2, b"\x50\x95\x22\x00", 0xE352 * 2, b"\x51\x95\x22\x00"),
                ]
                # somewhere within MPFS
                hostname_offset = 0x7DB8
                hostname_relative_offset = ~(0x8000 - hostname_offset - 1) & 0xFFFF
            elif hw == 2:
                offsets = [
                    (0x9FD4 * 2, b"\x50\x1a\x23\x00", 0xA534 * 2, b"\x51\x1a\x23\x00"),
                    (0xA8FC * 2, b"\x50\x1a\x23\x00", 0xAA4E * 2, b"\x51\x1a\x23\x00"),
                ]
                hostname_offset = 0x27000
                hostname_relative_offset = ~(0x28000 - hostname_offset - 1) & 0xFFFF
            elif hw == 3:
                offsets = [
                    (0xA0D8 * 2, b"\x50\x26\x23\x00", 0xA642 * 2, b"\x51\x26\x23\x00"),
                    (0xAA0A * 2, b"\x50\x26\x23\x00", 0xAB62 * 2, b"\x51\x26\x23\x00"),
                ]
                hostname_offset = 0x27000
                hostname_relative_offset = ~(0x28000 - hostname_offset - 1) & 0xFFFF
            elif hw == 4:
                offsets = [
                    (0xA140 * 2, b"\x30\x1c\x23\x00", 0xA6DE * 2, b"\x31\x1c\x23\x00"),
                    (0xAAA6 * 2, b"\x30\x1c\x23\x00", 0xABFE * 2, b"\x31\x1c\x23\x00"),
                ]
                hostname_offset = 0x27000
                hostname_relative_offset = ~(0x28000 - hostname_offset - 1) & 0xFFFF
            for addr in offsets:
                assert h.gets(addr[0], 4) == addr[1]
                mnemonic = 2 << 20 | hostname_relative_offset << 4 | 0
                mnemonic = mnemonic.to_bytes(4, "little")
                h.puts(addr[0], mnemonic)

                assert h.gets(addr[2], 4) == addr[3]
                mnemonic = 2 << 20 | hostname_relative_offset << 4 | 1
                mnemonic = mnemonic.to_bytes(4, "little")
                h.puts(addr[2], mnemonic)

        # interleave every 2 chars and put in new ROM location
        hostname = [hostname[i : i + 2] for i in range(0, len(hostname), 2)]
        hostname = b"\0\0".join(hostname)
        h.puts(hostname_offset * 2, hostname)

    # Patch #3: change HTTP port, we patch api and firmware client requests
    if port := patch.get("port"):
        if hw == 1:
            offsets = [0xD77C * 2, 0xE1E0 * 2]
        elif hw == 2:
            offsets = [0x9FD0 * 2, 0xA8F8 * 2]
        elif hw == 3:
            offsets = [0xA0D4 * 2, 0xAA06 * 2]
        elif hw == 4:
            offsets = [0xAAA2 * 2, 0xA13C * 2]
        elif hw == 5:
            offsets = [0xA6D8 * 2, 0xAE62 * 2]

        for addr in offsets:
            if hw == 5:
                assert h.gets(addr, 4) == b"\x00\x05\x20\x00"  # MOV      #80, W0
                mnemonic = 2 << 20 | port << 4 | 0
            else:
                assert h.gets(addr, 4) == b"\x03\x05\x20\x00"  # MOV      #80, W3
                mnemonic = 2 << 20 | port << 4 | 3
            mnemonic = mnemonic.to_bytes(4, "little")
            h.puts(addr, mnemonic)

    # Patch #4: replace 'hw.yourowl.com' or 'my.yourowl.com' host with 'thermosmart'
    # The 'thermosmart' hostname is used as a fallback for HW5 devices in case the device is not accessible after flashing
    if patch.get("replace_yourowl.com") is True:
        if hw == 5:
            seq = b"\x68\x00\x00\x77\x2e\x00\x00\x79\x6f\x00\x00\x75\x72\x00\x00\x6f\x77\x00\x00\x6c\x2e\x00\x00\x63\x6f\x00\x00\x6d"
            rep = b"\x74\x00\x00\x68\x65\x00\x00\x72\x6d\x00\x00\x6f\x73\x00\x00\x6d\x61\x00\x00\x72\x74\x00\x00\x00\x00\x00\x00\x00"
            addr = h.find(seq)
            assert addr > 0
        else:
            seq = b"\x68\x77\x00\x2e\x79\x6f\x00\x75\x72\x6f\x00\x77\x6c\x2e\x00\x63\x6f\x6d"
            rep = b"\x74\x68\x00\x65\x72\x6d\x00\x6f\x73\x6d\x00\x61\x72\x74\x00\x00\x00\x00"
            addr = h.find(seq)

            if addr <= 0:
                seq = b"\x6d\x79\x00\x2e\x79\x6f\x00\x75\x72\x6f\x00\x77\x6c\x2e\x00\x63\x6f\x6d"
                addr = h.find(seq)

            assert addr > 0
        h.puts(addr, rep)


IVT_START = 0
IVT_END = 0x400
BOOTLOADER_END = 0x2800
BLOCKSIZE = 256


def ts_fw_checksum(data):
    reg = 0
    if isinstance(data, str):
        for octet in data:
            reg += ord(octet)
    else:
        for octet in data:
            reg += octet

    return (256 - reg) & 0xFF


def get_blocks(h: IntelHex, start, end):
    r = ""
    for addr in range(start, end, BLOCKSIZE):
        data = h.tobinarray(addr, size=BLOCKSIZE)
        header = ":{:04X}0000".format(int(addr / BLOCKSIZE))
        line = "{}{:02X}{}{:02X}\r\n".format(
            header,
            ts_fw_checksum(header),
            hexlify(bytearray(data)).upper().decode(),
            ts_fw_checksum(data),
        )
        r = r + line
    return r


def hex2patchedts(fin, hw, patch):
    try:
        h = IntelHex(fin)
    except HexReaderError:
        return 1

    assert (h.maxaddr() + 1) % BLOCKSIZE == 0

    patchfirmware(h, hw, patch)

    # write header containing amount of blocks
    header = ":THW00{:02X}0000{:04X}".format(
        hw, int((IVT_END / BLOCKSIZE) + (h.maxaddr() + 1 - BOOTLOADER_END) / BLOCKSIZE)
    )
    header = "{}{:02X}\r\n".format(header, ts_fw_checksum(header))
    r = ""
    r += header

    # write IVT
    r += get_blocks(h, IVT_START, IVT_END)

    # skip bootloader and write rest of firmware
    r += get_blocks(h, BOOTLOADER_END, h.maxaddr())

    return r


# EJE Electronics hex format, version 79
def hex2patched_eje(fin, hw, patch):
    try:
        h = IntelHex(fin)
    except HexReaderError:
        return 1

    assert (h.maxaddr() + 1) % BLOCKSIZE == 0

    patchfirmware(h, hw, patch)

    # write header containing amount of blocks
    header = ":EJE{:04d}{:04X}".format(
        79, int((IVT_END / BLOCKSIZE) + (h.maxaddr() + 1 - BOOTLOADER_END) / BLOCKSIZE)
    )
    header = "{}{:02X}\r\n".format(header, ts_fw_checksum(header))
    r = ""
    r += header

    # write IVT
    r += get_blocks(h, IVT_START, IVT_END)

    # skip bootloader and write rest of firmware
    r += get_blocks(h, BOOTLOADER_END, h.maxaddr())

    return r


def get_firmware_name(hw, do_patch=False):
    if hw < 0 or hw > 5:
        raise Exception("no compatible firmware available")

    version = FIRMWARE_VERSIONS[hw]["sw"]
    if do_patch is True:
        version += UPGRADED_VERSION_MINOR
    return "ts_hw{}_{}.upd".format(hw, version)


def get_firmware(hw, patch=None):
    if hw < 0 or hw > 5:
        raise Exception("no compatible firmware available")

    filename = "TS_HW{}_{}.HEX".format(hw, FIRMWARE_VERSIONS[hw]["sw"])
    filename = os.path.join(os.getenv("APP_FOLDER"), "firmware", filename)

    if len(patch) > 0:
        patch |= {
            # Patch the new software version
            "version": FIRMWARE_VERSIONS[hw]["sw"]
            + UPGRADED_VERSION_MINOR,
        }

    if hw == 1:
        return hex2patched_eje(filename, hw, patch)
    else:
        return hex2patchedts(filename, hw, patch)


# This can be run as a standalone utility with the APP_FOLDER environment variable
# set to the root of the folder where the firmware folder resides.
if __name__ == "__main__":

    import argparse
    import logging
    from http.server import BaseHTTPRequestHandler, HTTPServer
    from urllib.parse import parse_qs

    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(
        prog="tsfwutil", formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command")
    serve = subparsers.add_parser("serve", help="Start webserver (HW5 only)")
    serve.add_argument("--port", type=int, default=80, help="Server port to listen to")
    serve.add_argument(
        "--username", type=str, required=True, help="Username used for device matching"
    )
    serve.add_argument(
        "--password", type=str, required=True, help="Password used for decryption"
    )
    save = subparsers.add_parser("save", help="Save firmware")
    for subparser in [serve, save]:
        subparser.add_argument(
            "--hw",
            type=int,
            default=[1, 2, 3, 4, 5],
            help="ThermoSmart hardware version",
            required=True,
        )
        subparser.add_argument(
            "--enablepatch",
            action=argparse.BooleanOptionalAction,
            help=" --enablePatch firmware?",
        )
        subparser.add_argument(
            "--patch-hostname",
            default="homeassistant",
            type=str,
            help="The hostname/ip to patch",
        )
        subparser.add_argument(
            "--patch-port", default=3888, type=int, help="The TCP port to patch"
        )
        subparser.add_argument(
            "--do-not-patch-yourowl",
            action=argparse.BooleanOptionalAction,
            help="Allow existance of my.yourowl.com or hw.yourowl.com in this firmware",
        )
    args = parser.parse_args()
    if not args.command:
        parser.parse_args(["--help"])
        exit(0)

    patch = {}
    if args.enablepatch is True:
        if args.patch_hostname:
            logging.info("Patching hostname to %s", args.patch_hostname)
            patch |= {
                "hostname": args.patch_hostname,
            }
        if args.patch_port:
            logging.info("Patching port to %s", args.patch_port)
            patch |= {
                "port": args.patch_port,
            }
        if not args.do_not_patch_yourowl:
            logging.info("Replacing 'hw.yourowl.com' domain with 'thermosmart'")
            patch |= {
                "replace_yourowl.com": True,
            }
    else:
        logging.info("No modifications made to original firmware")

    class TS(BaseHTTPRequestHandler):

        def _set_invalid_response(self):
            self.send_response(400)
            self.send_header("Content-type", "text/html")
            self.end_headers()

        def do_GET(self):
            arg = self.path.split("_")
            if len(arg) != 3:
                self._set_invalid_response()
                self.wfile.write("invalid request")
                return

            request = decrypt_request(arg[2], args.password)
            tsreq = parse_qs(request)

            if (
                "u" in tsreq
                and tsreq["u"][0] != args.username
                and "p" in tsreq
                and tsreq["p"][0] != args.password
                and "hw" in tsreq
                and int(tsreq["hw"][0]) != 5
            ):
                logging.warn(
                    "Not serving request for username: {}, password: {}".format(
                        tsreq["u"][0], tsreq["p"][0]
                    )
                )
                self._set_invalid_response()
                logging.error("incorrect credentials")
                return

            response = ""
            if arg[0] == "/api?":
                logging.info(
                    "We have a firmware update for {}:{} on hardware version {}".format(
                        tsreq["u"][0], tsreq["p"][0], tsreq["hw"][0]
                    )
                )
                response = encrypt_response(
                    "<ITHERMOSTAT><FW>1</FW></ITHERMOSTAT>", args.password
                )
            elif arg[0] == "/fw/hcu?":
                logging.info(
                    "Pushing firmware to {}:{} for hardware version {}".format(
                        tsreq["u"][0], tsreq["p"][0], tsreq["hw"][0]
                    )
                )

                firmware = get_firmware(args.hw, patch)
                response = encrypt_response(firmware, args.password)
            else:
                response = b""

            self.send_response(200)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.send_header("Content-length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)

    def run(server_class=HTTPServer, handler_class=TS, port=80):
        logging.info("Listening to port %d", port)
        server_address = ("", port)
        httpd = server_class(server_address, handler_class)
        logging.info("Starting httpd...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        httpd.server_close()
        logging.info("Stopping httpd...")

    if args.command == "serve":
        run(port=args.port)
    else:
        filename = get_firmware_name(args.hw, len(patch) > 0)
        # write as binary for correct line endings
        with open(filename, "wb") as fw:
            fw.write(get_firmware(args.hw, patch).encode())
            logging.info("Firmware written to: %s", filename)
