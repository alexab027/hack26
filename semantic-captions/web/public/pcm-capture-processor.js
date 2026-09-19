class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 4096;
    this.chunk = new Float32Array(this.chunkSize);
    this.offset = 0;
    this.active = false;
    this.port.onmessage = (event) => {
      if (event.data?.type === "start") {
        this.chunk = new Float32Array(this.chunkSize);
        this.offset = 0;
        this.active = true;
      } else if (event.data?.type === "stop") {
        this.active = false;
      }
    };
  }

  process(inputs) {
    if (!this.active) return true;
    const channels = inputs[0];
    if (!channels || channels.length === 0) return true;

    const frameCount = channels[0].length;
    for (let frame = 0; frame < frameCount; frame += 1) {
      let monoSample = 0;
      for (let channel = 0; channel < channels.length; channel += 1) {
        monoSample += channels[channel][frame] || 0;
      }
      this.chunk[this.offset] = monoSample / channels.length;
      this.offset += 1;

      if (this.offset === this.chunkSize) {
        this.port.postMessage(this.chunk, [this.chunk.buffer]);
        this.chunk = new Float32Array(this.chunkSize);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
