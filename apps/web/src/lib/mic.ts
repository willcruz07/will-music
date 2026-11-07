/** Microphone access tuned for music: no echo cancellation, noise suppression or automatic gain, which bend pitch and level. */
export const openMic = async (): Promise<{ context: AudioContext; source: MediaStreamAudioSourceNode; stream: MediaStream; close: () => void }> => {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não dá acesso ao microfone.');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
      throw new Error('O acesso ao microfone foi negado. Libere o microfone para este site nas permissões do navegador (ícone ao lado do endereço) e tente de novo.');
    }
    if (e instanceof DOMException && e.name === 'NotFoundError') throw new Error('Nenhum microfone encontrado neste aparelho.');
    throw e;
  }
  const context = new AudioContext({ latencyHint: 'interactive' });
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  return {
    context,
    source,
    stream,
    close: () => {
      stream.getTracks().forEach((t) => t.stop());
      void context.close();
    },
  };
};

// Collects microphone samples in blocks of ~0.1 s and hands them to the page (for the live chord model).
const WORKLET = `
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(4096); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice()); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('wm-tap', Tap);
`;

export const tapSamples = async (context: AudioContext, source: AudioNode, onSamples: (samples: Float32Array) => void): Promise<() => void> => {
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
  await context.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const node = new AudioWorkletNode(context, 'wm-tap');
  node.port.onmessage = (e: MessageEvent<Float32Array>) => onSamples(e.data);
  // A worklet only runs while connected to the output: route it through a silent gain (no echo).
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(node);
  node.connect(mute).connect(context.destination);
  return () => {
    node.port.onmessage = null;
    source.disconnect(node);
    node.disconnect();
  };
};
