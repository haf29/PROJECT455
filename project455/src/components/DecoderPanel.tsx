import { useState, type ChangeEvent } from "react";
import {
  Upload,
  Unlock,
  FileAudio,
  FileVideo,
  FileImage,
  FileText,
  Eye,
  Loader2,
  Copy,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  decodeAudio,
  decodeVideo,
  decodeImage,
  decodeText,
  isVideoFile,
  isAudioFile,
  isImageFile,
} from "@/lib/steganography";

export const DecoderPanel = () => {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [key, setKey] = useState("");
  const [encryptEnabled, setEncryptEnabled] = useState(true); // 🔥 NEW
  const [isDecoding, setIsDecoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [decodedMessage, setDecodedMessage] = useState("");
  const [watermarkedText, setWatermarkedText] = useState("");
  const [decodedTextMessage, setDecodedTextMessage] = useState("");
  const [isDecodingText, setIsDecodingText] = useState(false);
  const [decodedFile, setDecodedFile] = useState<{ url: string; filename: string } | null>(null);

  const clearDecodedFile = () =>
    setDecodedFile((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous.url);
      }
      return null;
    });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAudioFile(file) && !isVideoFile(file) && !isImageFile(file)) {
      toast.error("Please select an audio (WAV), video (MP4, WebM, etc.), or image (PNG, JPG) file");
      return;
    }
    setMediaFile(file);
    setDecodedMessage("");
    setDecodedTextMessage("");
    clearDecodedFile();
    const fileType = isVideoFile(file) ? "Video" : isImageFile(file) ? "Image" : "Audio";
    toast.success(`${fileType} file selected`);
  };

  const handleDownloadDecodedFile = () => {
    if (!decodedFile) return;
    const anchor = document.createElement("a");
    anchor.href = decodedFile.url;
    anchor.download = decodedFile.filename;
    anchor.click();
  };

  const handleDecode = async () => {
    if (!mediaFile) {
      toast.error("Please select an audio, video, or image file");
      return;
    }
    if (encryptEnabled && !key.trim()) {
      toast.error("Please enter the encryption key");
      return;
    }

    setIsDecoding(true);
    setProgress(0);
    setDecodedMessage("");
    setDecodedTextMessage("");
    clearDecodedFile();

    try {
      if (isVideoFile(mediaFile)) {
        const result = await decodeVideo(
          mediaFile,
          key,
          encryptEnabled, // 🔥 pass encrypt flag
          (prog: number) => setProgress(prog)
        );

        const message = result.message ?? "";
        const hasMessage = message.length > 0;
        const hasFile = result.file instanceof Blob;

        if (hasFile && result.file) {
          const filename = result.filename || "hidden_payload.bin";
          setDecodedFile({ url: URL.createObjectURL(result.file), filename });
        }
        if (hasMessage) {
          setDecodedMessage(message);
        }

        if (!hasFile && !hasMessage) {
          toast.info("No payload found in this video.");
        } else {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          if (hasFile && hasMessage) {
            toast.success("Hidden file and message extracted! ✨");
          } else if (hasFile) {
            toast.success("Hidden file extracted! ✨");
          } else {
            toast.success("Message decoded successfully! ✨");
          }
        }
      } else if (isImageFile(mediaFile)) {
        const result = await decodeImage(
          mediaFile,
          key,
          encryptEnabled, // 🔥 pass encrypt flag
          (prog: number) => setProgress(prog)
        );

        const message = result.message ?? "";
        const hasMessage = message.length > 0;
        const hasFile = result.file instanceof Blob;

        if (hasFile && result.file) {
          const filename = result.filename || "hidden_payload.bin";
          setDecodedFile({ url: URL.createObjectURL(result.file), filename });
        }
        if (hasMessage) {
          setDecodedMessage(message);
        }

        if (!hasFile && !hasMessage) {
          toast.info("No payload found in this image.");
        } else {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          if (hasFile && hasMessage) {
            toast.success("Hidden file and message extracted! ✨");
          } else if (hasFile) {
            toast.success("Hidden file extracted! ✨");
          } else {
            toast.success("Message decoded successfully! ✨");
          }
        }
      } else {
        const decoded = await decodeAudio(
          mediaFile,
          key,
          encryptEnabled, // 🔥 pass encrypt flag
          (prog: number) => setProgress(prog)
        );
        setDecodedMessage(decoded);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        toast.success("Message decoded successfully! ✨");
      }
    } catch (error: any) {
      console.error("Decoding error:", error);
      toast.error(error.message || "Failed to decode message. Check your key and file.");
      setDecodedMessage("");
      clearDecodedFile();
    } finally {
      setIsDecoding(false);
    }
  };

  const handleTextDecode = async () => {
    if (!watermarkedText.trim()) {
      toast.error("Please paste the watermarked text to decode");
      return;
    }
    if (encryptEnabled && !key.trim()) {
      toast.error("Please enter the encryption key");
      return;
    }

    setIsDecodingText(true);
    try {
      const message = await decodeText(watermarkedText, key, encryptEnabled); // 🔥 pass encrypt flag
      setDecodedTextMessage(message);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success("Hidden message extracted from text! ✨");
    } catch (error: any) {
      console.error("Text decode error:", error);
      toast.error(error.message || "Failed to extract message from text");
      setDecodedTextMessage("");
    } finally {
      setIsDecodingText(false);
    }
  };

  const handleCopyDecodedText = async () => {
    if (!decodedTextMessage) return;
    try {
      await navigator.clipboard.writeText(decodedTextMessage);
      toast.success("Decoded message copied to clipboard!");
    } catch (error) {
      console.error("Clipboard error:", error);
      toast.error("Failed to copy decoded message");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 glass-effect">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-accent/20">
            <Unlock className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Decode Message</h2>
            <p className="text-muted-foreground">
              Extract hidden messages from audio, video, or image files
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Encryption toggle */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Encrypted Payload</span>
            <Button
              variant={encryptEnabled ? "default" : "outline"}
              onClick={() => setEncryptEnabled(!encryptEnabled)}
              className="px-4 py-1"
            >
              {encryptEnabled ? "ON" : "OFF"}
            </Button>
          </div>

          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Stego Audio (WAV), Video (MP4, WebM, etc.), or Image (PNG, JPG) File
            </label>
            <div className="space-y-3">
              <label className="flex-1">
                <input
                  type="file"
                  accept="audio/wav,.wav,video/*,.mp4,.webm,.avi,.mov,image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex items-center gap-3 p-4 border-2 border-dashed border-accent/30 rounded-lg cursor-pointer hover:border-accent/50 transition-colors">
                  <Upload className="w-5 h-5 text-accent" />
                  <span className="text-foreground">
                    {mediaFile ? mediaFile.name : "Click to upload audio, video, or image file"}
                  </span>
                </div>
              </label>
              {mediaFile && (
                <Card className="p-3 glass-effect border-accent/20 animate-scale-in">
                  <div className="flex items-center gap-3">
                    {isVideoFile(mediaFile) ? (
                      <FileVideo className="w-8 h-8 text-accent" />
                    ) : isImageFile(mediaFile) ? (
                      <FileImage className="w-8 h-8 text-accent" />
                    ) : (
                      <FileAudio className="w-8 h-8 text-accent" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{mediaFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(mediaFile.size / 1024).toFixed(1)} KB •{" "}
                        {isVideoFile(mediaFile) ? "Video" : isImageFile(mediaFile) ? "Image" : "Audio"}
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Key input */}
          {encryptEnabled && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Encryption Key
              </label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter the encryption key used to encode..."
                className="w-full p-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enter the same key that was used to encode the message.
              </p>
            </div>
          )}

          <Button
            onClick={handleDecode}
            disabled={isDecoding || !mediaFile || (encryptEnabled && !key.trim())}
            size="lg"
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isDecoding ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Decoding... {Math.round(progress * 100)}%
              </>
            ) : (
              <>
                <Unlock className="w-5 h-5 mr-2" />
                Decode Message
              </>
            )}
          </Button>

          {isDecoding && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {progress < 0.3
                    ? "Reading carrier..."
                    : progress < 0.7
                    ? "Extracting..."
                    : "Decrypting..."}
                </span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-accent to-secondary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {decodedMessage && (
            <Card className="p-6 glass-effect border-accent/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Eye className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground text-lg">Decoded Message</h3>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-accent/20">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {decodedMessage}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-accent/10">
                <span className="text-sm text-muted-foreground">
                  ✓ Message successfully extracted
                </span>
              </div>
            </Card>
          )}

          {decodedFile && (
            <Card className="p-6 glass-effect border-primary/50 animate-scale-in">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-lg">Hidden File Extracted</h3>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-primary/20 mb-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {decodedFile.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">Ready for download</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleDownloadDecodedFile} className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download File
                </Button>
              </div>
            </Card>
          )}
        </div>
      </Card>

      <Card className="p-8 glass-effect">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-muted/20">
            <FileText className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Decode Watermarked Text</h2>
            <p className="text-muted-foreground">
              Reveal hidden messages embedded in plain text with zero-width characters.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Watermarked Text
            </label>
            <textarea
              value={watermarkedText}
              onChange={(e) => {
                setWatermarkedText(e.target.value);
                setDecodedTextMessage("");
              }}
              placeholder="Paste the text that contains a hidden watermark..."
              className="w-full p-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Invisible characters will be preserved automatically.
            </p>
          </div>

          <Button
            onClick={handleTextDecode}
            disabled={isDecodingText || !watermarkedText.trim() || (encryptEnabled && !key.trim())}
            size="lg"
            className="w-full bg-muted hover:bg-muted/80 text-foreground"
          >
            {isDecodingText ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Decoding watermark...
              </>
            ) : (
              <>
                <Unlock className="w-5 h-5 mr-2" />
                Decode Text Watermark
              </>
            )}
          </Button>

          {decodedTextMessage && (
            <Card className="p-6 glass-effect border-muted/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-muted/20">
                  <Eye className="w-5 h-5 text-foreground" />
                </div>
                <h3 className="font-semibold text-foreground text-lg">
                  Decoded Text Message
                </h3>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-border">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {decodedTextMessage}
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleCopyDecodedText}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Decoded Message
                </Button>
              </div>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
};
