import base64
import io
import os
from datetime import datetime
from typing import Optional, Set
from uuid import uuid4
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv

from stego.audio import embed_audio, extract_audio
from stego.audio_types import AudioProcessingError
from stego.image import embed_image, extract_image, ImageStegoError
from stego.video import embed_video, extract_video, VideoStegoError
from stego.image import embed_image, extract_image, ImageStegoError
from stego.video import embed_video, extract_video, VideoStegoError
from stego.text import embed_text, extract_text, TextStegoError

load_dotenv()

app = FastAPI(title="Stego API")

allowed_origin = os.getenv("CORS_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin] if allowed_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CHAT_HISTORY_LIMIT = 50
chat_history: list[dict] = []
chat_connections: Set[WebSocket] = set()


async def _broadcast_chat(message: dict) -> None:
    # Broadcast to all live connections; prune dead sockets quietly.
    stale: list[WebSocket] = []
    for ws in chat_connections:
        try:
            await ws.send_json(message)
        except Exception:
            stale.append(ws)
    for ws in stale:
        chat_connections.discard(ws)


async def _resolve_secret_payload(
    message_upload: Optional[UploadFile],
    secret_upload: Optional[UploadFile],
    require_text: bool = False,
) -> tuple[Optional[str], Optional[bytes], Optional[str]]:
    if secret_upload:
        secret_bytes = await secret_upload.read()
        if not secret_bytes:
            raise HTTPException(status_code=400, detail="Secret file is empty")
        return None, secret_bytes, secret_upload.filename or "secret.bin"

    if message_upload:
        payload = await message_upload.read()
        if not payload:
            raise HTTPException(status_code=400, detail="Message must not be empty")
        try:
            message = payload.decode("utf-8")
            if not message and require_text:
                raise HTTPException(status_code=400, detail="Message must not be empty")
            return message, None, None
        except UnicodeDecodeError:
            if require_text:
                raise HTTPException(status_code=400, detail="Message must be valid UTF-8 text")
            return None, payload, message_upload.filename or "secret.bin"

    raise HTTPException(status_code=400, detail="No secret payload provided")


def _file_json_response(content: bytes, filename: Optional[str]) -> JSONResponse:
    encoded = base64.b64encode(content).decode("ascii")
    return JSONResponse({"file": {"filename": filename or "secret.bin", "data": encoded}})


def _bool_from_form(value: str) -> bool:
    return value.lower() not in {"false", "0", "no"}


@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    chat_connections.add(websocket)

    # Send existing history to newly connected client.
    for entry in chat_history:
        try:
            await websocket.send_json(entry)
        except Exception:
            pass

    try:
        while True:
            payload = await websocket.receive_json()
            if not isinstance(payload, dict):
                await websocket.send_json({"type": "error", "message": "Invalid payload"})
                continue

            ciphertext = payload.get("ciphertext")
            sender = payload.get("sender") or "anonymous"
            cover = payload.get("cover") or ""

            if not isinstance(ciphertext, str) or not ciphertext.strip():
                await websocket.send_json({"type": "error", "message": "Missing ciphertext"})
                continue
            if not isinstance(cover, str) or not cover.strip():
                await websocket.send_json({"type": "error", "message": "Missing cover message"})
                continue

            message = {
                "type": "chat",
                "id": str(uuid4()),
                "ciphertext": ciphertext,
                "sender": sender,
                "cover": cover.strip(),
                "sent_at": datetime.utcnow().isoformat() + "Z",
            }

            chat_history.append(message)
            if len(chat_history) > CHAT_HISTORY_LIMIT:
                del chat_history[:-CHAT_HISTORY_LIMIT]

            await _broadcast_chat(message)
    except WebSocketDisconnect:
        chat_connections.discard(websocket)
    except Exception:
        chat_connections.discard(websocket)
        raise


@app.post("/api/audio/embed")
async def audio_embed(
    carrier: UploadFile = File(...),
    message: UploadFile = File(...),
    password: str = Form(...),
    ecc: str = Form("true"),
    encrypt: str = Form("true"),

):
    carrier_bytes = await carrier.read()
    message_bytes = await message.read()
    try:
        stego = embed_audio(
    carrier_bytes,
    message_bytes,
    password,
    encrypt=_bool_from_form(encrypt),
    use_ecc=_bool_from_form(ecc)
)

    except AudioProcessingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    buffer = io.BytesIO(stego)
    headers = {"Content-Disposition": "attachment; filename=stego.wav"}
    return StreamingResponse(buffer, media_type="audio/wav", headers=headers)


@app.post("/api/audio/extract")
async def audio_extract(
    carrier: UploadFile = File(...),
    password: str = Form(...),
    encrypt: str = Form("true"),

):
    carrier_bytes = await carrier.read()
    try:
        plain = extract_audio(carrier_bytes, password, encrypt=_bool_from_form(encrypt))

    except AudioProcessingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        message = plain.decode("utf-8")
    except UnicodeDecodeError:
        message = plain.decode("utf-8", errors="replace")
    return JSONResponse({"message": message})


@app.post("/api/video/embed")
async def video_embed(
    carrier: UploadFile = File(...),
    message: UploadFile | None = File(None),
    secret_file: UploadFile | None = File(None),
    password: str = Form(...),
    ecc: str = Form("true"),  # kept for backwards compatibility
    container: str = Form("mp4"),
    encrypt: str = Form("true"),

):
    video_bytes = await carrier.read()
    secret_message, secret_bytes, secret_filename = await _resolve_secret_payload(message, secret_file)
    try:
        content, ext = embed_video(
    video_bytes,
    password,
    container=container,
    encrypt=_bool_from_form(encrypt),
    secret_message=secret_message,
    secret_file=secret_bytes,
    secret_filename=secret_filename,
)

    except VideoStegoError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    mime = {
        "mp4": "video/mp4",
        "mkv": "video/x-matroska",
        "mov": "video/quicktime",
        "avi": "video/x-msvideo",
    }.get(ext, "video/mp4")
    headers = {"Content-Disposition": f"attachment; filename=stego.{ext}"}
    return StreamingResponse(io.BytesIO(content), media_type=mime, headers=headers)


@app.post("/api/video/extract")
async def video_extract(
    carrier: UploadFile = File(...),
    password: str = Form(...),
    encrypt: str = Form("true"),

):
    carrier_bytes = await carrier.read()
    try:
        message, file_bytes, filename = extract_video(
    carrier_bytes,
    password,
    encrypt=_bool_from_form(encrypt),
)

    except VideoStegoError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if file_bytes is not None:
        return _file_json_response(file_bytes, filename)
    return JSONResponse({"message": message})


@app.post("/api/image/embed")
async def image_embed(
    carrier: UploadFile = File(...),
    message: UploadFile | None = File(None),
    secret_file: UploadFile | None = File(None),
    password: str = Form(...),
    encrypt: str = Form("true"),

):
    carrier_bytes = await carrier.read()
    secret_message, secret_bytes, secret_filename = await _resolve_secret_payload(message, secret_file)
    try:
        stego_bytes = embed_image(
    carrier_bytes,
    password,
    encrypt=_bool_from_form(encrypt),
    secret_message=secret_message,
    secret_file=secret_bytes,
    secret_filename=secret_filename,
)

    except ImageStegoError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    headers = {"Content-Disposition": "attachment; filename=stego.png"}
    return StreamingResponse(io.BytesIO(stego_bytes), media_type="image/png", headers=headers)


@app.post("/api/image/extract")
async def image_extract(
    carrier: UploadFile = File(...),
    password: str = Form(...),
    encrypt: str = Form("true"),

):
    carrier_bytes = await carrier.read()
    try:
        message, file_bytes, filename = extract_image(
    carrier_bytes,
    password,
    encrypt=_bool_from_form(encrypt),
)

    except ImageStegoError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if file_bytes is not None:
        return _file_json_response(file_bytes, filename)
    return JSONResponse({"message": message})


@app.post("/api/text/embed")
async def text_embed(
    host_text: str = Form(...),
    message: str = Form(...),
    password: str = Form(...),
    encrypt: str = Form("true"),

):
    try:
        watermarked = embed_text(host_text, message, password, encrypt=_bool_from_form(encrypt))

    except TextStegoError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JSONResponse({"watermarked": watermarked})


@app.post("/api/text/extract")
async def text_extract(
    watermarked_text: str = Form(...),
    password: str = Form(...),
    encrypt: str = Form("true"),

):
    try:
        message = extract_text(watermarked_text, password, encrypt=_bool_from_form(encrypt))

    except TextStegoError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JSONResponse({"message": message})


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
