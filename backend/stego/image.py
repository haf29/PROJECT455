import io
import os
import base64
import tempfile
from typing import Optional

from PIL import Image
from stegano import lsb


class ImageStegoError(Exception):
    """Raised when image steganography operations fail."""


def _ensure_password(password: str) -> None:
    if not password:
        raise ImageStegoError("Password is required for image steganography")


# --- Simple XOR encryption for password-protected payload ---
def _encrypt(data: bytes, password: str) -> bytes:
    key = password.encode()
    return bytes([data[i] ^ key[i % len(key)] for i in range(len(data))])


def _decrypt(data: bytes, password: str) -> bytes:
    return _encrypt(data, password)  # XOR decrypt = encrypt


# --------------------------------------------------------------------- #
#                              EMBEDDING
# --------------------------------------------------------------------- #
def embed_image(
    carrier_bytes: bytes,
    password: str,
    *,
    secret_message: Optional[str] = None,
    secret_file: Optional[bytes] = None,
    secret_filename: Optional[str] = None,
) -> bytes:

    _ensure_password(password)

    if not secret_message and not secret_file:
        raise ImageStegoError("Either secret_message or secret_file must be provided")

    # Convert carrier to BMP (critical for LSB reliability)
    with tempfile.TemporaryDirectory(prefix="image-stego-") as tmpdir:
        carrier_path = os.path.join(tmpdir, "carrier.bmp")
        stego_path = os.path.join(tmpdir, "stego.bmp")

        try:
            Image.open(io.BytesIO(carrier_bytes)).convert("RGB").save(
                carrier_path, format="BMP"
            )
        except Exception as exc:
            raise ImageStegoError("Unsupported or corrupted carrier image") from exc

        # Prepare payload
        if secret_file is not None:
            payload = {
                "type": "file",
                "filename": secret_filename or "secret.bin",
                "data": base64.b64encode(secret_file).decode("utf-8"),
            }
        else:
            payload = {
                "type": "text",
                "data": secret_message,
            }

        # Serialize + encrypt
        import json
        raw = json.dumps(payload).encode("utf-8")
        encrypted = _encrypt(raw, password)
        b64_encrypted = base64.b64encode(encrypted).decode("utf-8")

        # ---- Capacity check so we don't call stegano with oversized data ----
        with Image.open(carrier_path) as im:
            width, height = im.size
            max_bits = width * height * 3       # 1 bit per color channel
            max_bytes = max_bits // 8

        if len(b64_encrypted) > max_bytes:
            raise ImageStegoError(
                f"Payload too large for image. Max: {max_bytes} bytes, "
                f"needed: {len(b64_encrypted)} bytes"
            )

        # Hide inside BMP (LSB)
        try:
            secret_img = lsb.hide(carrier_path, b64_encrypted)
            secret_img.save(stego_path, format="BMP")
        except Exception as exc:
            raise ImageStegoError("Failed to embed message in image") from exc

        # Return final image bytes
        try:
            with open(stego_path, "rb") as fh:
                return fh.read()
        except FileNotFoundError as exc:
            raise ImageStegoError("Unable to create stego image") from exc


# --------------------------------------------------------------------- #
#                              EXTRACTION
# --------------------------------------------------------------------- #
def extract_image(stego_bytes: bytes, password: str):
    _ensure_password(password)

    with tempfile.TemporaryDirectory(prefix="image-stego-") as tmpdir:
        stego_path = os.path.join(tmpdir, "stego.bmp")

        try:
            Image.open(io.BytesIO(stego_bytes)).convert("RGB").save(
                stego_path, format="BMP"
            )
        except Exception as exc:
            raise ImageStegoError("Unsupported or corrupted stego image") from exc

        # Extract raw LSB payload
        try:
            hidden = lsb.reveal(stego_path)
        except Exception as exc:
            raise ImageStegoError("Failed to extract message from image") from exc

        if hidden is None:
            raise ImageStegoError("No hidden message or file found in image")

        # Decode & decrypt
        try:
            encrypted = base64.b64decode(hidden.encode("utf-8"))
            raw = _decrypt(encrypted, password)
        except Exception:
            raise ImageStegoError("Incorrect password or corrupted payload")

        import json
        try:
            obj = json.loads(raw.decode("utf-8"))
        except Exception:
            raise ImageStegoError("Invalid embedded data format")

        # Message type check
        if obj["type"] == "text":
            return obj["data"], None, None

        elif obj["type"] == "file":
            return None, base64.b64decode(obj["data"]), obj["filename"]

        raise ImageStegoError("Unknown embedded payload type")
