import { useState } from "react";
import type { ChangeEvent, FC } from "react";
import {
  Upload,
  Lock,
  FileText,
  Download,
  Loader2,
  Copy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  encodeAudio,
  encodeVideo,
  encodeImage,
  encodeText,
  isVideoFile,
  isAudioFile,
  isImageFile,
} from "@/lib/steganography";

export const EncoderPanel: FC = () => {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [encryptEnabled, setEncryptEnabled] = useState(true); // 🔥 NEW
  const [secretFile, setSecretFile] = useState<File | null>(null);
  const [key, setKey] = useState("");
  const [isEncoding, setIsEncoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [encodedBlob, setEncodedBlob] = useState<Blob | null>(null);
  const [encodedExtension, setEncodedExtension] = useState(".wav");
  const [coverText, setCoverText] = useState("");
  const [textSecret, setTextSecret] = useState("");
  const [encodedText, setEncodedText] = useState("");
  const [isEncodingText, setIsEncodingText] = useState(false);

  const secretFileAllowed = mediaFile !== null && !isAudioFile(mediaFile);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isAudioFile(file) && !isVideoFile(file) && !isImageFile(file)) {
        toast.error(
          "Please select an audio (WAV), video (MP4, WebM, etc.), or image (PNG, JPG) file"
        );
        return;
      }
      setMediaFile(file);
      setEncodedBlob(null);
      setEncodedText("");
      setSecretFile(null);
      const fileType = isVideoFile(file)
        ? "Video"
        : isImageFile(file)
        ? "Image"
        : "Audio";
      toast.success(`${fileType} file selected`);
    }
  };

  const handleSecretFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!mediaFile) {
      toast.error("Select a carrier file before choosing a secret file.");
      return;
    }
    if (!secretFileAllowed) {
      toast.error("Audio carriers currently support text payloads only.");
      return;
    }

    setSecretFile(file);
    setEncodedBlob(null);
    toast.success(`Secret file selected (${file.name})`);
  };

  const removeSecretFile = () => {
    setSecretFile(null);
  };

  const handleEncode = async () => {
    if (!mediaFile) {
      toast.error("Please select an audio, video, or image file");
      return;
    }

    if (!message.trim() && !secretFile) {
      toast.error("Enter a secret message or choose a secret file to embed.");
      return;
    }

    if (encryptEnabled && !key.trim()) {
      toast.error("Please enter an encryption key");
      return;
    }

    if (isAudioFile(mediaFile) && secretFile) {
      toast.error("Audio carriers currently support text payloads only.");
      return;
    }

    setIsEncoding(true);
    setProgress(0);
    setEncodedBlob(null);

    try {
      let encoded: Blob;

      if (isVideoFile(mediaFile)) {
        encoded = await encodeVideo(mediaFile, key, {
          message,
          file: secretFile,
          encrypt: encryptEnabled,
          onProgress: (p) => setProgress(p),
        });
        setEncodedExtension(".mp4");
      } else if (isImageFile(mediaFile)) {
        encoded = await encodeImage(mediaFile, key, {
          message,
          file: secretFile,
          encrypt: encryptEnabled,
          onProgress: (p) => setProgress(p),
        });
        setEncodedExtension(".png");
      } else {
        encoded = await encodeAudio(
          mediaFile,
          message,
          key,
          encryptEnabled,
          (p) => setProgress(p)
        );
        setEncodedExtension(".wav");
      }

      setEncodedBlob(encoded);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

      toast.success(
        secretFile
          ? "Secret file embedded successfully! ✨"
          : "Message encoded successfully! ✨"
      );
    } catch (error: any) {
      console.error("Encoding error:", error);
      toast.error(error.message || "Failed to encode message");
    } finally {
      setIsEncoding(false);
    }
  };

  const handleTextEncode = async () => {
    if (!coverText.trim()) {
      toast.error("Please provide the host text that will carry the watermark");
      return;
    }

    if (!textSecret.trim()) {
      toast.error("Please enter the secret message to embed in the text");
      return;
    }

    if (encryptEnabled && !key.trim()) {
      toast.error("Please enter an encryption key");
      return;
    }

    setIsEncodingText(true);

    try {
      const watermarked = await encodeText(
        coverText,
        textSecret,
        key,
        encryptEnabled
      );
      setEncodedText(watermarked);

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success("Watermark embedded in text! ✨");
    } catch (error: any) {
      console.error("Text watermark error:", error);
      toast.error(error.message || "Failed to embed watermark into text");
    } finally {
      setIsEncodingText(false);
    }
  };

  const handleDownload = () => {
    if (!encodedBlob || !mediaFile) return;

    const url = URL.createObjectURL(encodedBlob);
    const a = document.createElement("a");

    a.href = url;
    const originalName = mediaFile.name.split(".")[0];
    a.download = `stego_${originalName}${encodedExtension}`;

    a.click();
    URL.revokeObjectURL(url);

    toast.success("Encoded file downloaded!");
  };

  const handleCopyWatermarked = async () => {
    if (!encodedText) return;

    try {
      await navigator.clipboard.writeText(encodedText);
      toast.success("Watermarked text copied!");
    } catch (error) {
      toast.error("Failed to copy watermarked text");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 glass-effect">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-primary/20">
            <Lock className="w-6 h-6 text-primary" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Encode Message</h2>
            <p className="text-muted-foreground">
              Hide your secret message in an audio, video, or image file
            </p>
          </div>
        </div>

        <div className="space-y-6">

          {/* 🔥 Encryption Toggle */}
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-foreground">
              Enable Encryption
            </label>

            <Button
              variant={encryptEnabled ? "default" : "outline"}
              onClick={() => setEncryptEnabled(!encryptEnabled)}
              className="px-4 py-1"
            >
              {encryptEnabled ? "ON" : "OFF"}
            </Button>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Audio (WAV), Video (MP4, WebM), or Image (PNG, JPG)
            </label>

            <input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept="audio/wav,.wav,video/*,.mp4,.webm,image/png,image/jpeg"
              id="file-upload"
            />

            <label
              htmlFor="file-upload"
              className="flex items-center gap-3 p-4 border-2 border-dashed border-primary/30
                         rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-5 h-5 text-primary" />
              <span>
                {mediaFile ? mediaFile.name : "Click to upload a media file"}
              </span>
            </label>
          </div>

          {/* Secret Message */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Secret Message
            </label>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter the secret message..."
              className="w-full p-4 border rounded-md bg-background text-foreground placeholder:text-muted-foreground"

            />
          </div>

          {/* Secret File Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-foreground">
                Secret File (Optional)
              </label>

              {secretFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeSecretFile}
                  className="text-xs"
                >
                  <X className="w-3 h-3 mr-1" /> Remove
                </Button>
              )}
            </div>

            <label
              className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed
                rounded-lg cursor-pointer text-sm 
                ${
                  secretFileAllowed
                    ? "border-primary/20 hover:border-primary/40"
                    : "opacity-50 cursor-not-allowed"
                }`}
            >
              <input
                type="file"
                className="hidden"
                onChange={handleSecretFileChange}
                disabled={!secretFileAllowed}
              />
              <Upload className="w-4 h-4 text-primary" />
              {secretFile ? secretFile.name : "Choose file to hide"}
            </label>
          </div>

          {/* Encryption Key */}
          {encryptEnabled && (
            <div>
              <label className="block text-sm font-medium">Encryption Key</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter encryption key"
                className="w-full p-3 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground"

              />
            </div>
          )}

          {/* Encode Button */}
          <Button
            onClick={handleEncode}
            disabled={
              isEncoding ||
              !mediaFile ||
              (!message.trim() && !secretFile) ||
              (encryptEnabled && !key.trim())
            }
            className="w-full flex items-center justify-center gap-2"
          >
            {isEncoding ? (
              <>
                <Loader2 className="animate-spin" />
                Encoding {Math.round(progress * 100)}%
              </>
            ) : (
              <>
                <Lock />
                Encode Message
              </>
            )}
          </Button>

          {isEncoding && (
            <div>
              <div className="flex justify-between text-sm">
                <span>
                  {progress < 0.3
                    ? "Encrypting..."
                    : progress < 0.7
                    ? "Embedding..."
                    : "Finalizing..."}
                </span>
                <span>{Math.round(progress * 100)}%</span>
              </div>

              <div className="w-full bg-muted h-2 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${progress * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Download */}
          {encodedBlob && (
            <Card className="p-5 border border-primary/40">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Encoding Complete!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your stego file is ready.
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={handleDownload}
                  className="flex gap-2 items-center"
                >
                  <Download className="w-4 h-4" /> Download
                </Button>
              </div>
            </Card>
          )}
        </div>
      </Card>

      {/* TEXT WATERMARK SECTION */}
      <Card className="p-8 glass-effect mt-4">
        <div className="flex gap-3 items-center mb-4">
          <div className="p-2 bg-secondary/20 rounded-lg">
            <FileText className="w-5 h-5 text-secondary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Encode Text Watermark</h2>
            <p className="text-muted-foreground">
              Hide secrets inside normal text invisibly.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Host text */}
          <div>
            <label className="block text-sm font-medium">Host Text</label>
            <textarea
              value={coverText}
              onChange={(e) => {
                setCoverText(e.target.value);
                setEncodedText("");
              }}
              className="w-full p-4 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground"
              rows={4}
            />
          </div>

          {/* Secret message */}
          <div>
            <label className="block text-sm font-medium">Secret Message</label>
            <textarea
              value={textSecret}
              onChange={(e) => {
                setTextSecret(e.target.value);
                setEncodedText("");
              }}
              className="w-full p-4 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground"
              rows={3}
            />
          </div>

          {/* Encryption key for text */}
          {encryptEnabled && (
            <div>
              <label className="block text-sm font-medium">Encryption Key</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full p-3 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}

          <Button
            onClick={handleTextEncode}
            disabled={
              isEncodingText ||
              !coverText.trim() ||
              !textSecret.trim() ||
              (encryptEnabled && !key.trim())
            }
            className="w-full flex gap-2 items-center bg-secondary"
          >
            {isEncodingText ? (
              <>
                <Loader2 className="animate-spin" />
                Embedding watermark...
              </>
            ) : (
              <>
                <Lock /> Encode Text Watermark
              </>
            )}
          </Button>

          {encodedText && (
            <Card className="p-4 border border-secondary/40 mt-4">
              <label className="block font-semibold mb-2">
                Watermarked Text:
              </label>

              <textarea
                readOnly
                value={encodedText}
                className="w-full p-3 border rounded-lg bg-muted"
                rows={4}
              />

              <Button
                onClick={handleCopyWatermarked}
                variant="outline"
                className="mt-3 flex gap-2 items-center"
              >
                <Copy className="w-4 h-4" /> Copy
              </Button>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
};
