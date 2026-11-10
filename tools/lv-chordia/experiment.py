"""Isolated ONNX feasibility probe. Does not modify or select the app's chord engine."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import time

import numpy as np
import onnx
import onnxruntime as ort
import torch
from lv_chordia.chordnet_ismir_naive import ChordNet
from lv_chordia.config import resolve_checkpoint_paths

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.cache'
HEADS = ['triad', 'bass', 'seventh', 'ninth', 'eleventh', 'thirteenth']


class CenteredInstanceNorm(torch.nn.Module):
    """Explicit centered variance avoids cancellation in E[x²] - E[x]² kernels."""
    def __init__(self, epsilon):
        super().__init__()
        self.epsilon = epsilon

    def forward(self, values):
        mean = values.mean(dim=3, keepdim=True).mean(dim=2, keepdim=True)
        centered = values - mean
        variance = (centered * centered).mean(dim=3, keepdim=True).mean(dim=2, keepdim=True)
        return centered / torch.sqrt(variance + self.epsilon)


def centered_norms(module):
    for name, child in list(module.named_children()):
        if isinstance(child, torch.nn.InstanceNorm2d):
            if child.affine or child.track_running_stats:
                raise ValueError('This rewrite requires the upstream non-affine input-statistics normalization.')
            setattr(module, name, CenteredInstanceNorm(child.eps))
        else:
            centered_norms(child)


def run(members: int, centered: bool):
    output = CACHE / ('export-centered' if centered else 'export')
    output.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(2)
    torch.manual_seed(7)
    rng = np.random.default_rng(7)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    _, entries = resolve_checkpoint_paths()
    revision = subprocess.check_output(['git', '-C', str(CACHE / 'upstream'), 'rev-parse', 'HEAD'], text=True).strip()
    report = {
        'upstreamCommit': revision, 'scope': 'synthetic feature parity; not musical accuracy or mobile benchmark',
        'torch': torch.__version__, 'onnxruntime': ort.__version__, 'models': [],
    }
    for member in range(min(members, len(entries))):
        checkpoint = Path(entries[member]['path'])
        checkpoint_hash = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
        if checkpoint_hash != entries[member]['sha256']:
            raise ValueError(f'Checkpoint SHA-256 mismatch: {checkpoint.name}')
        model = ChordNet(None, use_gpu=False).eval()
        state = torch.load(checkpoint, map_location='cpu', weights_only=True)
        model.load_state_dict(state['net'])
        if centered:
            centered_norms(model)
        sample = torch.from_numpy(rng.random((1, 96, 252), dtype=np.float32))
        path = output / f'chordnet-{member}.onnx'
        started = time.perf_counter()
        torch.onnx.export(
            model, (sample,), str(path), opset_version=17, dynamo=False,
            input_names=['features'], output_names=HEADS,
            dynamic_axes={'features': {1: 'frames'}, **{head: {0: 'frames'} for head in HEADS}},
        )
        graph = onnx.load(path)
        onnx.checker.check_model(graph)
        session = ort.InferenceSession(str(path), sess_options=options, providers=['CPUExecutionProvider'])
        item = {
            'member': member, 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'checkpointSha256': hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
            'exportAndLoadSeconds': time.perf_counter() - started,
            'operators': sorted({node.op_type for node in graph.graph.node}), 'cases': [],
        }
        for frames in (96, 192):
            features = rng.random((1, frames, 252), dtype=np.float32)
            with torch.inference_mode():
                reference = [tensor.numpy() for tensor in model(torch.from_numpy(features))]
            started = time.perf_counter()
            actual = session.run(None, {'features': features})
            elapsed = time.perf_counter() - started
            case = {'frames': frames, 'onnxCpuSeconds': elapsed, 'heads': {}}
            for name, expected, observed in zip(HEADS, reference, actual):
                np.testing.assert_allclose(observed, expected, rtol=1e-3, atol=1e-4)
                case['heads'][name] = {
                    'shape': list(observed.shape),
                    'maxAbsError': float(np.max(np.abs(expected - observed))),
                    'argmaxAgreement': float(np.mean(expected.argmax(-1) == observed.argmax(-1))),
                }
            if member == 0:
                features.tofile(output / f'features-{frames}.f32')
                for name, values in zip(HEADS, reference):
                    values.tofile(output / f'reference-{frames}-{name}.f32')
            item['cases'].append(case)
        report['models'].append(item)
        (CACHE / ('parity-report-centered.json' if centered else 'parity-report.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps({'member': member, 'bytes': item['bytes'], 'cases': item['cases']}), flush=True)
    (output / 'manifest.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--members', type=int, default=5)
    parser.add_argument('--centered-norm', action='store_true')
    args = parser.parse_args()
    run(args.members, args.centered_norm)
