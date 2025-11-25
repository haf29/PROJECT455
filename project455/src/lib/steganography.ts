const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

type ProgressHandler = (progress: number) => void;

export interface EncodePayloadOptions {
  message?: string;
  file?: File | null;
  container?: string;
  onProgress?: ProgressHandler;
  encrypt?: boolean;               // 🔥 ADDED
}

export interface DecodedPayload {
  message?: string;
  file?: Blob;
  filename?: string;
}

async function request(path: string, options: RequestInit, action: string): Promise<Response> {
  try {
    const response = await fetch(`${API_BASE}${path}`, options);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Backend returned ${response.status} for ${action}`);
    }
    return response;
  } catch (error: any) {
    if (error instanceof TypeError) {
      throw new Error(
        `Unable to reach the backend service at ${API_BASE} while trying to ${action}. ` +
        `Please ensure the FastAPI server is running (uvicorn app:app --host 0.0.0.0 --port 3001).`
      );
    }
    throw error;
  }
}

function appendMessage(fd: FormData, message?: string) {
  if (message && message.length > 0) {
    fd.append("message", new Blob([message], { type: "text/plain" }), "msg.txt");
  }
}

function appendSecretFile(fd: FormData, file?: File | null) {
  if (file) {
    fd.append("secret_file", file, file.name);
  }
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseDecodedPayload(json: any): DecodedPayload {
  if (json?.file?.data) {
    const filename: string | undefined = json.file.filename;
    const mime: string | undefined = json.file.content_type;
    const bytes = decodeBase64(json.file.data);
    const slice = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([slice], { type: mime ?? "application/octet-stream" });
    return { file: blob, filename };
  }
  if (typeof json?.message === "string") {
    return { message: json.message };
  }
  return {};
}

/* ------------------------------------------------------
 * AUDIO
 * -----------------------------------------------------*/
export async function encodeAudio(
  audioFile: File,
  message: string,
  key: string,
  encrypt: boolean,                         // 🔥 ADDED
  onProgress?: ProgressHandler
): Promise<Blob> {
  onProgress?.(0.1);
  const fd = new FormData();
  fd.append("carrier", audioFile);
  appendMessage(fd, message);
  fd.append("password", key);
  fd.append("ecc", "true");
  fd.append("encrypt", encrypt ? "true" : "false");  // 🔥 ADDED
  const res = await request("/api/audio/embed", { method: "POST", body: fd }, "encode audio");
  onProgress?.(1);
  return await res.blob();
}

export async function decodeAudio(
  audioFile: File,
  key: string,
  encrypt: boolean,                         // 🔥 ADDED
  onProgress?: ProgressHandler
): Promise<string> {
  onProgress?.(0.1);
  const fd = new FormData();
  fd.append("carrier", audioFile);
  fd.append("password", key);
  fd.append("encrypt", encrypt ? "true" : "false");  // 🔥 ADDED
  const res = await request("/api/audio/extract", { method: "POST", body: fd }, "decode audio");
  onProgress?.(1);
  const { message } = await res.json();
  return message;
}

/* ------------------------------------------------------
 * VIDEO
 * -----------------------------------------------------*/
export async function encodeVideo(
  videoFile: File,
  key: string,
  options: EncodePayloadOptions = {}
): Promise<Blob> {
  const { message, file, container = "mp4", onProgress, encrypt = true } = options; // 🔥 ADDED encrypt=true default
  onProgress?.(0.1);
  const fd = new FormData();
  fd.append("carrier", videoFile);
  appendMessage(fd, message);
  appendSecretFile(fd, file);
  fd.append("password", key);
  fd.append("ecc", "true");
  fd.append("container", container);
  fd.append("encrypt", encrypt ? "true" : "false");   // 🔥 ADDED
  const res = await request("/api/video/embed", { method: "POST", body: fd }, "encode video");
  onProgress?.(1);
  return await res.blob();
}

export async function decodeVideo(
  videoFile: File,
  key: string,
  encrypt: boolean = true,                      // 🔥 ADDED
  onProgress?: ProgressHandler
): Promise<DecodedPayload> {
  onProgress?.(0.1);
  const fd = new FormData();
  fd.append("carrier", videoFile);
  fd.append("password", key);
  fd.append("encrypt", encrypt ? "true" : "false");   // 🔥 ADDED
  const res = await request("/api/video/extract", { method: "POST", body: fd }, "decode video");
  onProgress?.(1);
  const json = await res.json();
  return parseDecodedPayload(json);
}

/* ------------------------------------------------------
 * IMAGE
 * -----------------------------------------------------*/
export async function encodeImage(
  imageFile: File,
  key: string,
  options: EncodePayloadOptions = {}
): Promise<Blob> {
  const { message, file, onProgress, encrypt = true } = options; // 🔥 ADDED encrypt default
  onProgress?.(0.1);
  const fd = new FormData();
  fd.append("carrier", imageFile);
  appendMessage(fd, message);
  appendSecretFile(fd, file);
  fd.append("password", key);
  fd.append("encrypt", encrypt ? "true" : "false");   // 🔥 ADDED
  const res = await request("/api/image/embed", { method: "POST", body: fd }, "encode image");
  onProgress?.(1);
  return await res.blob();
}

export async function decodeImage(
  imageFile: File,
  key: string,
  encrypt: boolean = true,                         // 🔥 ADDED
  onProgress?: ProgressHandler
): Promise<DecodedPayload> {
  onProgress?.(0.1);
  const fd = new FormData();
  fd.append("carrier", imageFile);
  fd.append("password", key);
  fd.append("encrypt", encrypt ? "true" : "false");   // 🔥 ADDED
  const res = await request("/api/image/extract", { method: "POST", body: fd }, "decode image");
  onProgress?.(1);
  const json = await res.json();
  return parseDecodedPayload(json);
}

/* ------------------------------------------------------
 * TEXT
 * -----------------------------------------------------*/
export async function encodeText(
  hostText: string,
  message: string,
  key: string,
  encrypt: boolean = true
): Promise<string> {
  const fd = new FormData();
  fd.append("host_text", hostText);
  fd.append("message", message);
  fd.append("password", key);
  fd.append("encrypt", encrypt ? "true" : "false");

  const res = await request("/api/text/embed", { method: "POST", body: fd }, "encode text");
  const { watermarked } = await res.json();
  return watermarked;
}


export async function decodeText(
  watermarkedText: string,
  key: string,
  encrypt: boolean = true
): Promise<string> {
  const fd = new FormData();
  fd.append("watermarked_text", watermarkedText);
  fd.append("password", key);
  fd.append("encrypt", encrypt ? "true" : "false");

  const res = await request("/api/text/extract", { method: "POST", body: fd }, "decode text");
  const { message } = await res.json();
  return message;
}


/* ------------------------------------------------------
 * TYPE CHECKERS
 * -----------------------------------------------------*/
export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/i.test(file.name);
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || /\.(wav|mp3|ogg|flac|aac|m4a)$/i.test(file.name);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|bmp|gif)$/i.test(file.name);
}
