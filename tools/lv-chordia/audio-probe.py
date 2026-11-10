"""Compare full-ensemble Python/ONNX output on a local WAV; never uploads audio."""
import argparse
import json
from pathlib import Path
from time import perf_counter
from types import SimpleNamespace

import librosa
import numpy as np
import onnxruntime as ort
import soundfile as sf
import torch
from lv_chordia.chordnet_ismir_naive import ChordNet
from lv_chordia.config import resolve_checkpoint_paths
from lv_chordia.extractors.xhmm_ismir import XHMMDecoder

ROOT = Path(__file__).resolve().parent
HEADS = ['triad', 'bass', 'seventh', 'ninth', 'eleventh', 'thirteenth']


def probe(audio_path: Path, polyphase=False):
    torch.set_num_threads(2)
    audio, rate = sf.read(audio_path, dtype='float32', always_2d=True)
    if rate != 22050:
        raise ValueError('Prepare a 22050 Hz WAV with ffmpeg before running this probe.')
    mono = audio.mean(axis=1)
    started = perf_counter()
    cqt = np.abs(librosa.hybrid_cqt(mono, sr=rate, bins_per_octave=36,
        fmin=librosa.note_to_hz('F#0'), n_bins=288, tuning=None, hop_length=512, res_type='polyphase' if polyphase else 'soxr_hq')).T.astype(np.float32)
    features = np.ascontiguousarray(cqt[:, 18:270][None, ...])
    report = {'scope': 'local audio feasibility; no human chord ground truth', 'seconds': len(mono) / rate,
        'frames': features.shape[1], 'cqtSeconds': perf_counter() - started, 'members': []}
    if polyphase:
        report['tuning'] = librosa.estimate_tuning(y=mono, sr=rate, bins_per_octave=36)
        features.tofile(ROOT / '.cache/browser-features-reference.f32')
    reference_probs = []
    onnx_probs = []
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    _, entries = resolve_checkpoint_paths()
    for member, entry in enumerate(entries):
        model = ChordNet(None, use_gpu=False).eval()
        model.load_state_dict(torch.load(entry['path'], map_location='cpu', weights_only=True)['net'])
        with torch.inference_mode():
            reference = model(torch.from_numpy(features))
            ref_prob = [tensor.softmax(-1).numpy() for tensor in reference]
        session = ort.InferenceSession(str(ROOT / '.cache/export' / f'chordnet-{member}.onnx'),
            sess_options=options, providers=['CPUExecutionProvider'])
        started = perf_counter()
        actual = session.run(None, {'features': features})
        timing = perf_counter() - started
        errors = {}
        for head, expected, observed in zip(HEADS, reference, actual):
            np.testing.assert_allclose(observed, expected.numpy(), atol=2e-4, rtol=1e-3)
            errors[head] = float(np.max(np.abs(observed - expected.numpy())))
        reference_probs.append(ref_prob)
        onnx_probs.append([torch.from_numpy(values).softmax(-1).numpy() for values in actual])
        report['members'].append({'member': member, 'onnxCpuSeconds': timing, 'maxAbsErrors': errors})
        if member == 0:
            features.tofile(ROOT / '.cache/export' / f'features-{features.shape[1]}.f32')
            for name, tensor in zip(HEADS, reference):
                tensor.numpy().tofile(ROOT / '.cache/export' / f'reference-{features.shape[1]}-{name}.f32')
        del model, session
    reference_probs = [np.mean([member[i] for member in reference_probs], axis=0) for i in range(6)]
    onnx_probs = [np.mean([member[i] for member in onnx_probs], axis=0) for i in range(6)]
    if polyphase:
        for name, values in zip(HEADS, reference_probs):
            values.tofile(ROOT / '.cache' / f'browser-probabilities-{name}.f32')
    template = ROOT / '.cache/upstream/lv_chordia/data/full_chord_list.txt'
    hmm = XHMMDecoder(template_file=str(template))
    entry = SimpleNamespace(prop=SimpleNamespace(hop_length=512, sr=rate))
    started = perf_counter()
    reference_segments = hmm.decode_to_chordlab(entry, reference_probs, False)
    segments = hmm.decode_to_chordlab(entry, onnx_probs, False)
    report['decodeBothSeconds'] = perf_counter() - started
    report['segmentLabelsMatch'] = [segment[2] for segment in segments] == [segment[2] for segment in reference_segments]
    report['segments'] = [{'start': float(start), 'end': float(end), 'raw': label} for start, end, label in segments]
    report['candidateCountAfterModelLimits'] = len(hmm.get_chord_tag_obs(onnx_probs)[0])
    (ROOT / ('.cache/browser-audio-report.json' if polyphase else '.cache/audio-report.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('audio', type=Path)
    parser.add_argument('--polyphase', action='store_true')
    args = parser.parse_args()
    probe(args.audio, args.polyphase)
