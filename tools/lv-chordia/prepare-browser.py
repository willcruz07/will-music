"""Build static filter banks/dictionary once. Browser analysis never executes this script."""
import hashlib
import importlib
import json
from pathlib import Path
import warnings
import librosa
import numpy as np
from scipy.signal import firwin
from lv_chordia.complex_chord import Chord
from lv_chordia.extractors.xhmm_ismir import XHMMDecoder
from bridge import label

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / '.cache/browser'
WIDTHS = [73, 13, 4, 4, 3, 3]


def write(name, value):
    path = OUTPUT / name
    path.write_text(json.dumps(value, separators=(',', ':')), encoding='utf-8')
    return {'file': name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def make_plan(tuning):
    cq = importlib.import_module('librosa.core.constantq')
    resample = cq.audio.resample
    response = cq.__cqt_response
    signal = np.zeros(22050 * 2, dtype=np.float32)
    nodes = {id(signal): 0}
    keep = [signal]
    levels = []
    groups = []
    def capture_resample(y, **kwargs):
        out = resample(y, **kwargs)
        factor = int(kwargs['orig_sr'] / kwargs['target_sr'])
        taps = firwin(20 * factor + 1, 1 / factor, window=('kaiser', 5.0)).tolist()
        levels.append({'parent': nodes[id(y)], 'factor': factor, 'taps': taps})
        nodes[id(out)] = len(levels)
        keep.append(out)
        return out
    def capture_response(y, n_fft, hop_length, fft_basis, mode, **kwargs):
        basis = fft_basis.tocsr()
        groups.append({'level': nodes[id(y)], 'fft': int(n_fft), 'hop': int(hop_length),
            'pseudo': not kwargs.get('phase', True), 'offsets': basis.indptr.tolist(),
            'bins': basis.indices.tolist(), 'real': basis.data.real.tolist(), 'imag': basis.data.imag.tolist(),
            'rows': int(basis.shape[0])})
        return response(y, n_fft, hop_length, fft_basis, mode, **kwargs)
    cq.audio.resample = capture_resample
    cq.__cqt_response = capture_response
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            librosa.hybrid_cqt(signal, sr=22050, hop_length=512, fmin=librosa.note_to_hz('F#0'),
                n_bins=288, bins_per_octave=36, tuning=tuning, res_type='polyphase')
    finally:
        cq.audio.resample = resample
        cq.__cqt_response = response
    pseudo = sum(group['rows'] for group in groups if group['pseudo'])
    full = 288 - pseudo
    upper = full
    fmin = librosa.note_to_hz('F#0') * 2 ** (tuning / 36)
    freqs = librosa.cqt_frequencies(n_bins=full, fmin=fmin, bins_per_octave=36)
    # The first full-CQT response uses the sample rate after early downsampling.
    first = next(group for group in groups if not group['pseudo'])
    early_factor = 512 / first['hop']
    lengths, _ = librosa.filters.wavelet_lengths(freqs=freqs, sr=22050 / early_factor)
    for group in groups:
        if group['pseudo']:
            group['start'] = full
            group['scales'] = [1 / np.sqrt(group['fft'])] * group['rows']
        else:
            upper -= group['rows']
            group['start'] = upper
            group['scales'] = (1 / np.sqrt(lengths[upper:upper + group['rows']])).tolist()
    return {'tuning': tuning, 'levels': levels, 'groups': groups}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    plans = []
    for index in range(100):
        plans.append(write(f'cqt-{index}.json', make_plan(-0.5 + index / 100)))
    decoder = XHMMDecoder(template_file=str(ROOT / '.cache/upstream/lv_chordia/data/full_chord_list.txt'))
    candidates = []
    for values, raw in decoder.known_chord_array:
        if any(value >= limit for value, limit in zip(values, WIDTHS)):
            continue
        candidates.append({'raw': raw, 'label': label(raw), 'indices': [int(values[0]), int(values[1]) + 1, *[int(value) for value in values[2:]]]})
    dictionary = write('dictionary.json', candidates)
    source = json.loads((ROOT / '.cache/export-centered/manifest.json').read_text(encoding='utf-8'))
    manifest = {'version': 'lv-browser-polyphase-v1', 'preprocessing': 'hybrid CQT, automatic tuning, polyphase resampling',
        'upstreamCommit': source['upstreamCommit'], 'models': [{'file': f"chordnet-{item['member']}.onnx", 'sha256': item['sha256'], 'bytes': item['bytes']} for item in source['models']],
        'plans': plans, 'dictionary': dictionary}
    write('manifest.json', manifest)
    print(json.dumps({'plans': len(plans), 'candidates': len(candidates), 'planBytes': sum(item['bytes'] for item in plans)}))


if __name__ == '__main__':
    main()
