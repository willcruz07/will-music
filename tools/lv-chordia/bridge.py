"""Development-only local CQT/decoder bridge; no networking and no model execution."""
import argparse
import json
from pathlib import Path
from types import SimpleNamespace
import librosa
import numpy as np
from lv_chordia.complex_chord import Chord, NUM_TO_ABS_SCALE
from lv_chordia.extractors.xhmm_ismir import XHMMDecoder

ROOT = Path(__file__).resolve().parent
WIDTHS = [73, 13, 4, 4, 3, 3]


def label(raw):
    if raw == 'N':
        return 'N.C.'
    chord = Chord(raw)
    suffix = raw.split(':', 1)[1].split('/')[0]
    basic, *extra = suffix.split('(', 1)
    names = {'maj': '', 'min': 'm', 'maj7': '7M', 'min7': 'm7', 'minmaj7': 'm(7M)',
        'hdim7': 'm7(b5)', 'dim': '°', 'dim7': '°7', 'aug': '+', 'maj6': '6', 'min6': 'm6',
        '9': '7(9)', '11': '7(9,11)', '13': '7(9,11,13)',
        'min9': 'm7(9)', 'maj9': '7M(9)', 'min11': 'm7(9,11)', 'min13': 'm7(9,11,13)', 'maj13': '7M(9,11,13)'}
    suffix = names.get(basic, basic) + ('(' + extra[0] if extra else '')
    return NUM_TO_ABS_SCALE[chord.root] + suffix + ('/' + NUM_TO_ABS_SCALE[chord.bass] if chord.bass != chord.root else '')


def main(action, source, target):
    if action == 'prepare':
        audio = np.fromfile(source, dtype='<f4')
        if not len(audio) or len(audio) > 22050 * 60 or not np.isfinite(audio).all():
            raise ValueError('Use um trecho válido de até 60 segundos.')
        cqt = np.abs(librosa.hybrid_cqt(audio, sr=22050, bins_per_octave=36,
            fmin=librosa.note_to_hz('F#0'), n_bins=288, tuning=None, hop_length=512)).T
        np.ascontiguousarray(cqt[:, 18:270], dtype='<f4').tofile(target)
    else:
        values = np.fromfile(source, dtype='<f4')
        frames, remainder = divmod(len(values), sum(WIDTHS))
        if remainder or not 1 <= frames <= 2585 or not np.isfinite(values).all():
            raise ValueError('Previsões inválidas.')
        probabilities = []
        offset = 0
        for width in WIDTHS:
            size = frames * width
            probabilities.append(values[offset:offset + size].reshape(frames, width))
            offset += size
        decoder = XHMMDecoder(template_file=str(ROOT / '.cache/upstream/lv_chordia/data/full_chord_list.txt'))
        entry = SimpleNamespace(prop=SimpleNamespace(hop_length=512, sr=22050))
        segments = decoder.decode_to_chordlab(entry, probabilities, False)
        target.write_text(json.dumps([{'start': float(start), 'end': float(end), 'raw': raw, 'label': label(raw)}
            for start, end, raw in segments]), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'decode'])
    parser.add_argument('source', type=Path)
    parser.add_argument('target', type=Path)
    args = parser.parse_args()
    main(args.action, args.source, args.target)
