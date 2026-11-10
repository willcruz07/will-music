"""Locate the first divergent stage; writes only ignored diagnostics."""
from pathlib import Path
import numpy as np
import torch
from lv_chordia.chordnet_ismir_naive import ChordNet
from lv_chordia.config import resolve_checkpoint_paths

root = Path(__file__).resolve().parent / '.cache/export'
torch.set_num_threads(2)
_, entries = resolve_checkpoint_paths()
model = ChordNet(None, use_gpu=False).eval()
model.load_state_dict(torch.load(entries[0]['path'], map_location='cpu', weights_only=True)['net'])

class Trace(torch.nn.Module):
    def __init__(self, network):
        super().__init__()
        self.network = network

    def forward(self, features):
        first = self.network.audio_feature_block.conv1a(features[:, None, :, :])
        norm = self.network.audio_feature_block.norm1a(first)
        activation = torch.nn.functional.selu(norm)
        cnn = self.network.audio_feature_block(features)
        recurrent = self.network.lstm1(cnn, self.network.init_hidden(1, 192))[0]
        return first, norm, activation, cnn, recurrent, self.network.final_fc1(recurrent)

wrapper = Trace(model).eval()
features = torch.from_numpy(np.fromfile(root / 'features-1292.f32', dtype=np.float32).reshape(1, 1292, 252))
with torch.inference_mode():
    reference = wrapper(features)
names = ['first', 'norm', 'activation', 'cnn', 'recurrent', 'fc']
for name, tensor in zip(names, reference):
    tensor.numpy().tofile(root / f'trace-{name}.f32')
torch.onnx.export(wrapper, (features,), str(root / 'trace.onnx'), dynamo=False, opset_version=17,
    input_names=['features'], output_names=names)
