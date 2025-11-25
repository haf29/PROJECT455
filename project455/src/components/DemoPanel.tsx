import { useState } from "react";
import { Play, Sparkles, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { encodeAudio, decodeAudio } from "@/lib/steganography";

const DEMO_MESSAGE = "This is a secret message hidden using LSB steganography! 🔐";
const DEMO_KEY = "demo_secret_key_2024";

export const DemoPanel = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [encodedBlob, setEncodedBlob] = useState<Blob | null>(null);
  const [decodedMessage, setDecodedMessage] = useState("");

  const steps = [
    { title: "Generate Sample Audio", description: "Create a clean audio file" },
    { title: "Hide Secret Message", description: "Encode message using LSB" },
    { title: "Extract Message", description: "Decode the hidden message" },
    { title: "Complete!", description: "See the results" },
  ];

  const runDemo = async () => {
    setIsRunning(true);
    setStep(0);
    setDecodedMessage("");
    setEncodedBlob(null);

    try {
      // Step 1
      toast.info("Step 1: Generating sample audio...");
      await new Promise((resolve) => setTimeout(resolve, 800));
      const sampleAudio = await generateSampleAudio();
      setStep(1);

      // Step 2
      toast.info("Step 2: Hiding secret message...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      // IMPORTANT: encryption disabled in demo (false)
      const encoded = await encodeAudio(
        new File([sampleAudio], "sample.wav", { type: "audio/wav" }),
        DEMO_MESSAGE,
        DEMO_KEY,
        false,           // 🔥 DISABLE ENCRYPTION
        () => {}         // onProgress callback
      );

      setEncodedBlob(encoded);
      setStep(2);

      // Step 3
      toast.info("Step 3: Extracting hidden message...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      const decoded = await decodeAudio(
        new File([encoded], "stego_sample.wav", { type: "audio/wav" }),
        DEMO_KEY,
        false,          // 🔥 DISABLE ENCRYPTION FOR DEMO
        () => {}        // onProgress
      );

      setDecodedMessage(decoded);
      setStep(3);

      toast.success("Demo completed successfully! ✨");
    } catch (error) {
      console.error("Demo error:", error);
      toast.error("Demo encountered an error");
    } finally {
      setIsRunning(false);
    }
  };

  const downloadStego = () => {
    if (!encodedBlob) return;
    const url = URL.createObjectURL(encodedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "demo_stego.wav";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Demo file downloaded!");
  };

  return (
    <div className="space-y-8">
      <Card className="p-8 glass-effect text-center animate-fade-in">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-4">
          <Sparkles className="w-12 h-12 text-primary animate-pulse-glow" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3">Interactive Demo</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
          Watch steganography in action! This demo will generate a sample audio file,
          hide a secret message, and then extract it.
        </p>

        <Button
          onClick={runDemo}
          disabled={isRunning}
          size="lg"
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow-primary px-8 py-6 text-lg group"
        >
          {isRunning ? (
            <>
              <Play className="w-5 h-5 mr-2 animate-pulse" />
              Running Demo...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2 group-hover:translate-x-1 transition-transform" />
              Start Demo
            </>
          )}
        </Button>
      </Card>

      {step > 0 && (
        <div className="grid md:grid-cols-4 gap-4 animate-fade-in">
          {steps.map((s, index) => (
            <Card
              key={index}
              className={`p-4 text-center transition-all ${
                index < step
                  ? "glass-effect border-primary/50"
                  : index === step
                  ? "glass-effect border-accent shadow-glow-accent"
                  : "bg-muted/20 border-muted"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center font-bold ${
                  index < step
                    ? "bg-primary/20 text-primary"
                    : index === step
                    ? "bg-accent/20 text-accent animate-pulse-glow"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1">
                {s.title}
              </h3>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </Card>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="grid md:grid-cols-2 gap-6 animate-scale-in">
          <Card className="p-6 glass-effect border-primary/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-primary/20">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-lg">Original Message</h3>
            </div>
            <div className="p-4 rounded-lg bg-background/50 border border-primary/20">
              <p className="text-foreground">{DEMO_MESSAGE}</p>
            </div>
          </Card>

          <Card className="p-6 glass-effect border-accent/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-accent/20">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground text-lg">Decoded Message</h3>
            </div>
            <div className="p-4 rounded-lg bg-background/50 border border-accent/20">
              <p className="text-foreground">{decodedMessage}</p>
            </div>
          </Card>
        </div>
      )}

      {encodedBlob && (
        <Card className="p-6 glass-effect text-center animate-fade-in">
          <h3 className="font-semibold text-foreground text-lg mb-4">
            Try It Yourself
          </h3>
          <p className="text-muted-foreground mb-6">
            Download the demo stego file and decode it using:{" "}
            <code className="text-primary font-mono">{DEMO_KEY}</code>
          </p>
          <Button
            onClick={downloadStego}
            variant="outline"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Stego File
          </Button>
        </Card>
      )}
    </div>
  );
};

/* ---------------- SAMPLE AUDIO GENERATION ---------------- */

const generateSampleAudio = async (): Promise<Blob> => {
  const audioContext = new AudioContext();
  const sampleRate = audioContext.sampleRate;
  const duration = 1; 
  const frequency = 440; 

  const audioBuffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < channelData.length; i++) {
    channelData[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate)) * 0.3;
  }

  return audioBufferToWav(audioBuffer);
};

const audioBufferToWav = async (audioBuffer: AudioBuffer): Promise<Blob> => {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(
        offset,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
};
