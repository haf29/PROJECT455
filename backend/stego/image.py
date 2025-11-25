import io
import os
import base64
import tempfile
from typing import Optional

from PIL import Image
from stegano import lsb
import json


class ImageStegoError(Exception):
    """Raised when image steganography operations fail."""


def _ensure_password(password: str) -> None:
    # Password is optional IF encrypt=False
    return


# --- Simple XOR encryption ----
def _encrypt(data: bytes, password: str) -> bytes:
    if not password:
        return data
    key = password.encode()
    return bytes([data[i] ^ key[i % len(key)] for i in range(len(data))])


def _decrypt(data: bytes, password: str) -> bytes:
    return _encrypt(data, password)  # XOR decrypt = encrypt


# ================================================================
#                         EMBEDDING
# ================================================================
def embed_image(
    carrier_bytes: bytes,
    password: str,
    *,
    encrypt: bool = True,
    secret_message: Optional[str] = None,
    secret_file: Optional[bytes] = None,
    secret_filename: Optional[str] = None,
) -> bytes:

    if not secret_message and not secret_file:
        raise ImageStegoError("Either secret_message or secret_file must be provided")

    # Convert carrier to BMP
    with tempfile.TemporaryDirectory(prefix="image-stego-") as tmpdir:
        carrier_path = os.path.join(tmpdir, "carrier.bmp")
        stego_path = os.path.join(tmpdir, "stego.bmp")

        try:
            Image.open(io.BytesIO(carrier_bytes)).convert("RGB").save(
                carrier_path, format="BMP"
            )
        except Exception as exc:
            raise ImageStegoError("Unsupported or corrupted carrier image") from exc

        # Build payload object
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

        # Serialize payload
        raw = json.dumps(payload).encode("utf-8")

        # Encrypt (optional)
        if encrypt:
            if not password:
                raise ImageStegoError("Password required when encrypt=True")
            encrypted = _encrypt(raw, password)
        else:
            encrypted = raw

        b64_encrypted = base64.b64encode(encrypted).decode("utf-8")

        # Capacity limit check
        with Image.open(carrier_path) as im:
            width, height = im.size
            max_bits = width * height * 3
            max_bytes = max_bits // 8

        if len(b64_encrypted) > max_bytes:
            raise ImageStegoError(
                f"Payload too large for image. Max: {max_bytes} bytes, needed: {len(b64_encrypted)} bytes"
            )

        # Hide
        try:
            secret_img = lsb.hide(carrier_path, b64_encrypted)
            secret_img.save(stego_path, format="BMP")
        except Exception as exc:
            raise ImageStegoError("Failed to embed message in image") from exc

        # Return bytes
        try:
            with open(stego_path, "rb") as fh:
                return fh.read()
        except FileNotFoundError as exc:
            raise ImageStegoError("Unable to create stego image") from exc


# ================================================================
#                         EXTRACTION
# ================================================================
def extract_image(stego_bytes: bytes, password: str, encrypt: bool = True):
    with tempfile.TemporaryDirectory(prefix="image-stego-") as tmpdir:
        stego_path = os.path.join(tmpdir, "stego.bmp")

        try:
            Image.open(io.BytesIO(stego_bytes)).convert("RGB").save(
                stego_path, format="BMP"
            )
        except Exception as exc:
            raise ImageStegoError("Unsupported or corrupted stego image") from exc

        # Extract hidden data
        try:
            hidden = lsb.reveal(stego_path)
        except Exception as exc:
            raise ImageStegoError("Failed to extract message from image") from exc

        if not hidden:
            raise ImageStegoError("No hidden message or file found in image")

        # Decode base64 → encrypted bytes
        try:
            encrypted = base64.b64decode(hidden.encode("utf-8"))
        except Exception:
            raise ImageStegoError("Corrupted payload")

        # Decrypt if needed
        if encrypt:
            if not password:
                raise ImageStegoError("Password required when encrypt=True")
            raw = _decrypt(encrypted, password)
        else:
            raw = encrypted

        # Load JSON payload
        try:
            obj = json.loads(raw.decode("utf-8"))
        except Exception:
            raise ImageStegoError("Invalid embedded data format")

        # Return result
        if obj["type"] == "text":
            return obj["data"], None, None

        if obj["type"] == "file":
            return (
                None,
                base64.b64decode(obj["data"]),
                obj["filename"],
            )

        raise ImageStegoError("Unknown embedded payload type")
