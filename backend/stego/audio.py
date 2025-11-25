from typing import List

from .audio_types import AudioProcessingError
from .crypto import derive_key, encrypt_ctr, decrypt_ctr
from .ecc import bytes_to_bits, bits_to_bytes, hamming_decode, hamming_encode
from .wav import parse_wav, WavFormatError

MAGIC = b"STG1"


def _ensure_audio(password: str, encrypt: bool) -> bytes:
    if encrypt:
        if not password:
            raise AudioProcessingError("Password required when encryption=True")
        return derive_key(password)
    else:
        return b""  # dummy key, not used



def embed_audio(wav_bytes: bytes, payload: bytes, password: str, encrypt: bool = True, use_ecc: bool = True)-> bytes:
    try:
        data_offset, data_size, _ = parse_wav(wav_bytes)
    except WavFormatError as exc:
        raise AudioProcessingError(str(exc)) from exc

    key = _ensure_audio(password, encrypt)
    if encrypt:
        encrypted = encrypt_ctr(key, payload)
    else:
        encrypted = payload  # store plaintext
    flags = bytes([1 if use_ecc else 0])
    header = MAGIC + flags + len(encrypted).to_bytes(4, "big")

    bits: List[int] = bytes_to_bits(encrypted)
    if use_ecc:
        bits = hamming_encode(bits)
    body = bits_to_bytes(bits)
    full = header + body

    total_bits = len(full) * 8
    samples = data_size // 2
    if total_bits > samples:
        raise AudioProcessingError("Not enough capacity in carrier audio")

    wav = bytearray(wav_bytes)
    for bit_index in range(total_bits):
        byte = full[bit_index >> 3]
        bit = (byte >> (7 - (bit_index & 7))) & 1
        byte_offset = data_offset + bit_index * 2
        wav[byte_offset] = (wav[byte_offset] & 0xFE) | bit

    return bytes(wav)


def extract_audio(wav_bytes: bytes, password: str, encrypt: bool = True) -> bytes:
    try:
        data_offset, data_size, _ = parse_wav(wav_bytes)
    except WavFormatError as exc:
        raise AudioProcessingError(str(exc)) from exc

    key = _ensure_audio(password,encrypt)
    total_samples = data_size // 2

    def read_bits(count: int, start_bit: int) -> List[int]:
        bits: List[int] = []
        for i in range(count):
            absolute_bit = start_bit + i
            if absolute_bit >= total_samples:
                raise AudioProcessingError("Truncated payload")
            bit = wav_bytes[data_offset + absolute_bit * 2] & 1
            bits.append(bit)
        return bits

    wav_bits = read_bits(32, 0)
    if bytes(bits_to_bytes(wav_bits))[:4] != MAGIC:
        raise AudioProcessingError("No payload found")

    flags = bits_to_bytes(read_bits(8, 32))[0]
    enc_len_bytes = bits_to_bytes(read_bits(32, 40))[:4]
    enc_len = int.from_bytes(enc_len_bytes, "big")

    use_ecc = bool(flags & 1)
    body_start = 72
    if use_ecc:
        body_bits = (enc_len * 8 * 7 + 3) // 4
    else:
        body_bits = enc_len * 8

    raw_bits = read_bits(body_bits, body_start)
    if use_ecc:
        raw_bits = hamming_decode(raw_bits)
    enc_bytes = bytes(bits_to_bytes(raw_bits))[:enc_len]

    if encrypt:
        decrypted = decrypt_ctr(key, enc_bytes)
    else:
        decrypted = enc_bytes
    return decrypted
