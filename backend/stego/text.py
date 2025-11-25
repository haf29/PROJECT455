from text_blind_watermark import TextBlindWatermark


class TextStegoError(Exception):
    """Raised when text steganography operations fail."""


def _ensure_password(password: str) -> bytes:
    if not password:
        raise TextStegoError("Password is required for text steganography")
    return password.encode("utf-8")


def embed_text(host_text: str, message: str, password: str, encrypt: bool = True) -> str:
    if not host_text.strip():
        raise TextStegoError("Host text must not be empty")
    if not message:
        raise TextStegoError("Message must not be empty")

    if encrypt:
        if not password:
             raise TextStegoError("Password required when encrypt=True")
        pwd = password.encode("utf-8")
    else:
        pwd = b"default-key"   # deterministic, no-encryption mode


    try:
        tbw = TextBlindWatermark(pwd)
        watermarked = tbw.add_wm_at_last(host_text, message.encode("utf-8"))
    except Exception as exc:  # pragma: no cover - external library
        raise TextStegoError("Failed to embed text watermark") from exc
    return watermarked


def extract_text(watermarked_text: str, password: str, encrypt: bool = True) -> str:

    if not watermarked_text:
        raise TextStegoError("Watermarked text must not be empty")

    # ----------- ADD PASSWORD VALIDATION & KEY SELECTION HERE -----------
    if encrypt:
        if not password:
            raise TextStegoError("Password required when encrypt=True")
        pwd = password.encode("utf-8")
    else:
        pwd = b"default-key"
    # --------------------------------------------------------------------

    try:
        tbw = TextBlindWatermark(pwd)
        payload = tbw.extract(watermarked_text)
    except Exception as exc:
        raise TextStegoError("Failed to extract text watermark") from exc

    if not payload:
        raise TextStegoError("No hidden message found in text")

    try:
        return payload.decode("utf-8")
    except UnicodeDecodeError:
        return payload.decode("latin-1")


    if not watermarked_text:
        raise TextStegoError("Watermarked text must not be empty")

    pwd = _ensure_password(password)
    try:
        tbw = TextBlindWatermark(pwd)
        payload = tbw.extract(watermarked_text)
    except Exception as exc:  # pragma: no cover
        raise TextStegoError("Failed to extract text watermark") from exc

    if not payload:
        raise TextStegoError("No hidden message found in text")

    try:
        return payload.decode("utf-8")
    except UnicodeDecodeError:
        # Fallback to latin-1 to avoid losing bytes, then re-encode/ decode
        return payload.decode("latin-1")

