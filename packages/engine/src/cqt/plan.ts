// Ported from Musetric (https://github.com/musetric/musetric), MIT License,
// commit f37b6b1b054e08db0ec4411479b8092524d6dac2:
// packages/cqt/src/cqt/{config,plan,planDecode}.es.ts and
// packages/cqt/src/resample/config.es.ts. See THIRD_PARTY_NOTICES.md.

export type CqtOutput = 'magnitude' | 'logMagnitude';

export type CqtConfig = {
  sampleRate: number;
  hopLength: number;
  fmin: number;
  nBins: number;
  binsPerOctave: number;
  output: CqtOutput;
};

export type HalfBandDownsamplePlan = {
  tapCount: number;
  halfCoefficients: Float32Array;
  gain: number;
  delay: number;
  boundary: 'constant';
};

export type CqtOctavePlan = {
  index: number;
  sampleRate: number;
  hopLength: number;
  fftSize: number;
  binStart: number;
  binCount: number;
};

export type CqtPlan = {
  formatVersion: number;
  generator: string;
  config: CqtConfig;
  earlyDownsampleCount: number;
  octaves: readonly CqtOctavePlan[];
  rowOffsets: Uint32Array;
  fftBins: Uint32Array;
  coefficients: Float32Array;
  binLengths: Float32Array;
  downsample: HalfBandDownsamplePlan;
  payloadSha256: string;
};

const isPositiveInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

const validateCqtConfig = (config: CqtConfig): void => {
  if (!Number.isFinite(config.sampleRate) || config.sampleRate <= 0) {
    throw new RangeError('CQT sampleRate must be a positive finite number');
  }
  if (!isPositiveInteger(config.hopLength)) throw new RangeError('CQT hopLength must be a positive safe integer');
  if (!Number.isFinite(config.fmin) || config.fmin <= 0) throw new RangeError('CQT fmin must be a positive finite number');
  if (!isPositiveInteger(config.nBins)) throw new RangeError('CQT nBins must be a positive safe integer');
  if (!isPositiveInteger(config.binsPerOctave)) throw new RangeError('CQT binsPerOctave must be a positive safe integer');
  if (config.output !== 'magnitude' && config.output !== 'logMagnitude') {
    throw new RangeError(`Unsupported CQT output: ${String(config.output)}`);
  }
};

const validateDownsample = (plan: HalfBandDownsamplePlan): void => {
  if (!Number.isSafeInteger(plan.tapCount) || plan.tapCount < 3 || plan.tapCount % 2 === 0) {
    throw new RangeError('Downsample tapCount must be an odd integer of at least 3');
  }
  if (plan.halfCoefficients.length !== (plan.tapCount + 1) / 2) {
    throw new RangeError('Downsample halfCoefficients have an invalid length');
  }
  if (!Number.isFinite(plan.gain) || plan.gain <= 0) throw new RangeError('Downsample gain must be positive');
  if (!Number.isSafeInteger(plan.delay) || plan.delay < 0) throw new RangeError('Downsample delay must be non-negative');
};

const validateCqtPlan = (plan: CqtPlan): void => {
  if (!isPositiveInteger(plan.formatVersion)) throw new RangeError('CQT plan formatVersion must be positive');
  if (plan.generator.length === 0) throw new RangeError('CQT plan generator must not be empty');
  validateCqtConfig(plan.config);
  if (!Number.isSafeInteger(plan.earlyDownsampleCount) || plan.earlyDownsampleCount < 0) {
    throw new RangeError('CQT earlyDownsampleCount must be non-negative');
  }
  const octaveCount = Math.ceil(plan.config.nBins / plan.config.binsPerOctave);
  if (plan.octaves.length !== octaveCount) throw new RangeError('CQT plan octave count does not match its config');
  let expectedBinStart = plan.config.nBins;
  for (const octave of plan.octaves) {
    if (!Number.isSafeInteger(octave.index) || octave.index < 0) throw new RangeError('CQT octave index is invalid');
    if (!Number.isFinite(octave.sampleRate) || octave.sampleRate <= 0) throw new RangeError('CQT octave sampleRate is invalid');
    if (!isPositiveInteger(octave.hopLength)) throw new RangeError('CQT octave hopLength is invalid');
    if (!isPositiveInteger(octave.fftSize) || octave.fftSize % 2 !== 0) throw new RangeError('CQT octave fftSize is invalid');
    if (!isPositiveInteger(octave.binCount)) throw new RangeError('CQT octave binCount is invalid');
    expectedBinStart -= octave.binCount;
    if (octave.binStart !== expectedBinStart) throw new RangeError('CQT octaves must map high frequencies to low');
  }
  if (expectedBinStart !== 0) throw new RangeError('CQT octave bins do not cover the configured CQT bins');
  if (plan.rowOffsets.length !== plan.config.nBins + 1 || plan.rowOffsets[0] !== 0) {
    throw new RangeError('CQT rowOffsets are invalid');
  }
  for (let i = 1; i < plan.rowOffsets.length; i++) {
    if (plan.rowOffsets[i]! < plan.rowOffsets[i - 1]!) throw new RangeError('CQT rowOffsets must be monotonic');
  }
  const coefficientCount = plan.rowOffsets[plan.rowOffsets.length - 1]!;
  if (plan.fftBins.length !== coefficientCount) throw new RangeError('CQT fftBins length does not match rowOffsets');
  if (plan.coefficients.length !== coefficientCount * 2) throw new RangeError('CQT coefficients must be interleaved complex');
  if (plan.binLengths.length !== plan.config.nBins) throw new RangeError('CQT binLengths have an invalid length');
  validateDownsample(plan.downsample);
  if (!/^[a-f0-9]{64}$/u.test(plan.payloadSha256)) throw new RangeError('CQT plan payloadSha256 must be a SHA-256 hex digest');
};

const magic = 0x5451434d;
const headerByteLength = 128;
const octaveByteLength = 32;

const checkRange = (offset: number, byteLength: number, payloadEnd: number, label: string): void => {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(byteLength) ||
    offset < headerByteLength ||
    byteLength < 0 ||
    offset + byteLength > payloadEnd
  ) {
    throw new RangeError(`Invalid CQT plan ${label} range`);
  }
  if (offset % 4 !== 0 && label !== 'generator') {
    throw new RangeError(`CQT plan ${label} offset must be aligned to 4 bytes`);
  }
};

export const decodeCqtPlan = (artifact: Uint8Array): CqtPlan => {
  const bytes = artifact.slice();
  if (bytes.byteLength < headerByteLength) throw new RangeError('CQT plan artifact is shorter than its header');
  const data = new DataView(bytes.buffer);
  if (data.getUint32(0, true) !== magic) throw new RangeError('CQT plan artifact has an invalid magic value');
  const formatVersion = data.getUint32(4, true);
  if (data.getUint32(8, true) !== headerByteLength) throw new RangeError('CQT plan artifact has an unsupported header size');
  const payloadEnd = headerByteLength + data.getUint32(60, true);
  if (payloadEnd !== bytes.byteLength) throw new RangeError('CQT plan artifact has an invalid payload size');
  const outputKind = data.getUint32(12, true);
  if (outputKind > 1) throw new RangeError('CQT plan artifact has an unsupported output kind');

  const config: CqtConfig = {
    sampleRate: data.getFloat64(16, true),
    hopLength: data.getUint32(24, true),
    nBins: data.getUint32(28, true),
    binsPerOctave: data.getUint32(32, true),
    fmin: data.getFloat64(40, true),
    output: outputKind === 0 ? 'magnitude' : 'logMagnitude',
  };
  const earlyDownsampleCount = data.getUint32(36, true);
  const octaveCount = data.getUint32(48, true);
  const tapCount = data.getUint32(52, true);
  const coefficientCount = data.getUint32(56, true);
  const generatorByteLength = data.getUint32(64, true);
  const generatorOffset = data.getUint32(68, true);
  const octavesOffset = data.getUint32(72, true);
  const rowOffsetsOffset = data.getUint32(76, true);
  const fftBinsOffset = data.getUint32(80, true);
  const coefficientsOffset = data.getUint32(84, true);
  const binLengthsOffset = data.getUint32(88, true);
  const downsampleOffset = data.getUint32(92, true);
  const rowCount = config.nBins + 1;
  const halfCoefficientCount = (tapCount + 1) / 2;

  checkRange(generatorOffset, generatorByteLength, payloadEnd, 'generator');
  checkRange(octavesOffset, octaveCount * octaveByteLength, payloadEnd, 'octaves');
  checkRange(rowOffsetsOffset, rowCount * 4, payloadEnd, 'row offsets');
  checkRange(fftBinsOffset, coefficientCount * 4, payloadEnd, 'FFT bins');
  checkRange(coefficientsOffset, coefficientCount * 8, payloadEnd, 'coefficients');
  checkRange(binLengthsOffset, config.nBins * 4, payloadEnd, 'bin lengths');
  checkRange(downsampleOffset, halfCoefficientCount * 4, payloadEnd, 'downsample coefficients');

  let generator = '';
  for (let i = 0; i < generatorByteLength; i++) {
    const character = bytes[generatorOffset + i]!;
    if (character > 0x7f) throw new RangeError('CQT plan generator must use ASCII text');
    generator += String.fromCharCode(character);
  }

  const octaves: CqtOctavePlan[] = [];
  for (let i = 0; i < octaveCount; i++) {
    const base = octavesOffset + i * octaveByteLength;
    octaves.push({
      index: data.getUint32(base, true),
      sampleRate: data.getFloat64(base + 4, true),
      hopLength: data.getUint32(base + 12, true),
      fftSize: data.getUint32(base + 16, true),
      binStart: data.getUint32(base + 20, true),
      binCount: data.getUint32(base + 24, true),
    });
  }

  let payloadSha256 = '';
  for (let i = 0; i < 32; i++) payloadSha256 += data.getUint8(96 + i).toString(16).padStart(2, '0');

  const plan: CqtPlan = {
    formatVersion,
    generator,
    config,
    earlyDownsampleCount,
    octaves,
    rowOffsets: new Uint32Array(bytes.buffer, rowOffsetsOffset, rowCount),
    fftBins: new Uint32Array(bytes.buffer, fftBinsOffset, coefficientCount),
    coefficients: new Float32Array(bytes.buffer, coefficientsOffset, coefficientCount * 2),
    binLengths: new Float32Array(bytes.buffer, binLengthsOffset, config.nBins),
    downsample: {
      tapCount,
      halfCoefficients: new Float32Array(bytes.buffer, downsampleOffset, halfCoefficientCount),
      gain: Math.SQRT2,
      delay: (tapCount - 1) / 2,
      boundary: 'constant',
    },
    payloadSha256,
  };
  validateCqtPlan(plan);
  return plan;
};

declare const crypto: { subtle: { digest: (algorithm: string, data: ArrayBuffer) => Promise<ArrayBuffer> } };

export const verifyCqtPlan = async (artifact: Uint8Array): Promise<CqtPlan> => {
  const plan = decodeCqtPlan(artifact);
  const payload = artifact.slice(headerByteLength);
  const digest = await crypto.subtle.digest('SHA-256', payload.buffer);
  const actual = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('');
  if (actual !== plan.payloadSha256) throw new RangeError('CQT plan artifact payload SHA-256 does not match');
  return plan;
};
