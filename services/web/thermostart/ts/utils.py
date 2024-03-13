import base64
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
    {"hw": 1, "filename": "TS_HW1_20141018.hex", "version": 20141019},
    {"hw": 2, "filename": "TS_HW2_30020018.hex", "version": 30020018},
    {"hw": 3, "filename": "TS_HW3_30030030.hex", "version": 30030030},
    {"hw": 4, "filename": "TS_HW4_30040043.hex", "version": 30040043},
    {"hw": 5, "filename": "TS_HW5_30050046.hex", "version": 30050046},
]
UPGRADED_VERSION_MINOR = 200


def firmware_upgrade_needed(hw, fw):
    return next(
        item
        for item in FIRMWARE_VERSIONS
        if item["version"] + UPGRADED_VERSION_MINOR != fw and item["hw"] == hw
    )


def decrypt_request(request, passwd):
    tempkey = passwd + TS_MASTER_KEY[len(passwd) :]
    arc4 = ARC4.new(tempkey.encode())
    return arc4.decrypt(base64.b16decode(request)).decode()


def encrypt_response(response, passwd, hexencoded=True):
    tempkey = passwd + TS_MASTER_KEY[len(passwd) :]
    arc4 = ARC4.new(tempkey.encode())
    response = arc4.encrypt(response.encode())
    if hexencoded is True:
        return base64.b16encode(response)
    else:
        return response


def patchfirmware(h: IntelHex, hw, host, port):

    # Patch #1: we patch the version number
    if hw == 1:
        addr_lo = 0x216BC * 2
        addr_hi = 0x216BE * 2

        assert h.gets(addr_lo, 4) == b"\xe0\x36\x25\x00"  # MOV      #0x536E, W0
        assert h.gets(addr_hi, 4) == b"\x31\x13\x20\x00"  # MOV      #0x133, W1

        # we use the 3rd character for our patched firmware
        version = 20141019 + UPGRADED_VERSION_MINOR

    elif hw == 2:
        addr_lo = 0x1CC9E * 2
        addr_hi = 0x1CCA0 * 2

        assert h.gets(addr_lo, 4) == b"\x20\x1b\x21\x00"  # MOV      #0x11B2, W0
        assert h.gets(addr_hi, 4) == b"\xa1\x1c\x20\x00"  # MOV      #0x1CA, W1

        # we use the 3rd character for our patched firmware
        version = 30020018 + UPGRADED_VERSION_MINOR

    elif hw == 3:
        addr_lo = 0x1D728 * 2
        addr_hi = 0x1D72A * 2

        assert h.gets(addr_lo, 4) == b"\xe0\x8c\x23\x00"  # MOV      #0x38CE, W0
        assert h.gets(addr_hi, 4) == b"\xa1\x1c\x20\x00"  # MOV      #0x1CA, W1

        # we use the 3rd character for our patched firmware
        version = 30030030 + UPGRADED_VERSION_MINOR

    elif hw == 4:
        addr_lo = 0x1D7CC * 2
        addr_hi = 0x1D7CE * 2

        assert h.gets(addr_lo, 4) == b"\xb0\xfe\x25\x00"  # MOV      #0x5FEB, W0
        assert h.gets(addr_hi, 4) == b"\xa1\x1c\x20\x00"  # MOV      #0x1CA, W1

        # we use the 3rd character for our patched firmware
        version = 30040043 + UPGRADED_VERSION_MINOR

    elif hw == 5:
        addr_lo = 0x106E8 * 2
        addr_hi = 0x106EA * 2

        assert h.gets(addr_lo, 4) == b"\xe0\x6f\x28\x00"  # MOV      #0x86FE, W0
        assert h.gets(addr_hi, 4) == b"\xa1\x1c\x20\x00"  # MOV      #0x1CA, W1

        # we use the 3rd character for our patched firmware
        version = 30050046 + UPGRADED_VERSION_MINOR

    version_lo = version & 0xFFFF
    version_hi = version >> 16

    mnemonic = 2 << 20 | version_lo << 4 | 0
    mnemonic = mnemonic.to_bytes(4, "little")
    h.puts(addr_lo, mnemonic)

    mnemonic = 2 << 20 | version_hi << 4 | 1
    mnemonic = mnemonic.to_bytes(4, "little")
    h.puts(addr_hi, mnemonic)

    # Patch #2: we are going to replace hw.thermosmart.nl with our own hostname
    if isinstance(host, str):
        host = host.encode("ascii")

    # our own hostname is limited to the length of the original name len('hw.thermosmart.nl') == 17
    host = host.ljust(17, b"\0")[0:17]

    if hw == 5:
        org = b"\x68\x77\x00\x00\x2e\x74\x00\x00\x68\x65\x00\x00\x72\x6d\x00\x00\x6f\x73\x00\x00\x6d\x61\x00\x00\x72\x74\x00\x00\x2e\x6e\x00\x00\x6c"
        addr = h.find(org)
        assert addr > 0

        # interleave every 2 chars
        host = [host[i : i + 2] for i in range(0, len(host), 2)]
        host = b"\0\0".join(host)
        h.puts(addr, host)

    else:
        org = b"\x68\x77\x00\x2e\x74\x68\x00\x65\x72\x6d\x00\x6f\x73\x6d\x00\x61\x72\x74\x00\x2e\x6e\x6c"
        addr = h.find(org)
        assert addr > 0

        # first two characters are misaligned for convenience we add a temporary 0
        host = b"\0" + host
        # interleave every 3 chars
        host = [host[i : i + 3] for i in range(0, len(host), 3)]
        host = b"\0".join(host)[1:]
        h.puts(addr, host)

    # Patch #3: disable 'hw.yourowl.com' or 'my.yourowl.com' host
    if hw == 5:
        seq = b"\x68\x00\x00\x77\x2e\x00\x00\x79\x6f\x00\x00\x75\x72\x00\x00\x6f\x77\x00\x00\x6c\x2e\x00\x00\x63\x6f\x00\x00\x6d"
        addr = h.find(seq)
        assert addr > 0
    else:
        seq = (
            b"\x68\x77\x00\x2e\x79\x6f\x00\x75\x72\x6f\x00\x77\x6c\x2e\x00\x63\x6f\x6d"
        )
        addr = h.find(seq)

        if addr <= 0:
            seq = b"\x6d\x79\x00\x2e\x79\x6f\x00\x75\x72\x6f\x00\x77\x6c\x2e\x00\x63\x6f\x6d"
            addr = h.find(seq)

        assert addr > 0
    h.puts(addr, b"".ljust(len(seq), b"\0"))

    # Patch #4: change HTTP port, we patch api and firmware client requests
    # offsets as displayed in IDA need to be multiplied by 2
    if hw == 1:
        offsets = [0xD77C * 2, 0xD7C4 * 2, 0xE1E0 * 2, 0xE1F4 * 2]
    elif hw == 2:
        offsets = [0x9FD0 * 2, 0xA018 * 2, 0xA8F8 * 2, 0xA90C * 2]
    elif hw == 3:
        offsets = [0xA0D4 * 2, 0xA11C * 2, 0xAA06 * 2, 0xAA1A * 2]
    elif hw == 4:
        offsets = [0xAAA2 * 2, 0xAAB6 * 2, 0xA13C * 2, 0xA184 * 2]
    elif hw == 5:
        offsets = [0xA6D8 * 2, 0xA708 * 2, 0xAE62 * 2, 0xAE8E * 2]

    for addr in offsets:
        if hw == 5:
            assert h.gets(addr, 4) == b"\x00\x05\x20\x00"  # MOV      #80, W0
            mnemonic = 2 << 20 | port << 4 | 0
        else:
            assert h.gets(addr, 4) == b"\x03\x05\x20\x00"  # MOV      #80, W3
            mnemonic = 2 << 20 | port << 4 | 3
        mnemonic = mnemonic.to_bytes(4, "little")
        h.puts(addr, mnemonic)


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


def hex2patchedts(fin, hw, host, port):
    try:
        h = IntelHex(fin)
    except HexReaderError:
        return 1

    assert (h.maxaddr() + 1) % BLOCKSIZE == 0

    patchfirmware(h, hw, host, port)

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
def hex2patched_eje(fin, hw, host, port):
    try:
        h = IntelHex(fin)
    except HexReaderError:
        return 1

    assert (h.maxaddr() + 1) % BLOCKSIZE == 0

    patchfirmware(h, hw, host, port)

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


def get_patched_firmware_by_hw_version(version, host, port):
    if version == 1:
        filename = "firmware/TS_HW1_20141018.hex"
    elif version == 2:
        filename = "firmware/TS_HW2_30020018.hex"
    elif version == 3:
        filename = "firmware/TS_HW3_30030030.hex"
    elif version == 4:
        filename = "firmware/TS_HW4_30040043.hex"
    elif version == 5:
        filename = "firmware/TS_HW5_30050046.hex"
    else:
        raise Exception("no compatible firmware available")

    if version == 1:
        return hex2patched_eje(filename, version, host, port)
    else:
        return hex2patchedts(filename, version, host, port)
