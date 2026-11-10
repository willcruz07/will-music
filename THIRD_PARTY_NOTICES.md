# Third-party notices

## LV-Chordia / Music X Lab — MIT License

The browser chord-analysis engine uses converted LV-Chordia checkpoints and ports its
uniform-transition chord decoder to TypeScript. Static dictionaries and filter banks are prepared offline.
Source: https://github.com/openmirlab/lv-chordia/tree/d8ab9ac99bce081bb79065d717f96e2c3b2099c8
Original research: https://github.com/music-x-lab/ISMIR2019-Large-Vocabulary-Chord-Recognition

Copyright (c) 2023 Music X Lab

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Musetric

Partes de `packages/engine` foram portadas de [Musetric](https://github.com/musetric/musetric), commit `f37b6b1b054e08db0ec4411479b8092524d6dac2`. O nome e o logo "Musetric" são marcas do autor e não são usados neste projeto.

```
MIT License

Copyright (c) 2020-2026 Vladlen Popelenkov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

The MIT License above does not grant any rights in the Musetric name or logo.
The logo files (every `favicon.svg` in this repository and every image derived
from them) are not part of the "Software" and are not licensed under it. The
reserved rights and permitted uses are set out in [trademark.md](trademark.md).
```

## Modelos

| Modelo | Revisão | Licença |
|---|---|---|
| [musetric/chordmini-onnx](https://huggingface.co/musetric/chordmini-onnx) (ChordMini ChordNet 2E1D, export ONNX) | `8ab85fc0f61439900cd07ac21257a43eac57075c` | MIT |
| [musetric/skey-onnx](https://huggingface.co/musetric/skey-onnx) (S-KEY, Deezer, export ONNX) | `9d90d2a9ff6679df1d64000f4fa750643f247643` | MIT |

## Basic Pitch (Spotify) — Apache License 2.0

The note-transcription model `nmp.onnx` (downloaded at run time from huggingface.co/daserge/basic-pitch-onnx,
byte-identical to spotify/basic-pitch `basic_pitch/saved_models/icassp_2022/nmp.onnx`) and the windowing and
note-creation logic ported in `packages/engine/src/score/` come from https://github.com/spotify/basic-pitch.
Copyright 2022 Spotify AB. Licensed under the Apache License, Version 2.0.

## OpenSheetMusicDisplay — BSD 3-Clause License

Score rendering uses opensheetmusicdisplay (https://github.com/opensheetmusicdisplay/opensheetmusicdisplay),
Copyright (c) 2019 PhonicScore. Licensed under the BSD 3-Clause License.

## HTDemucs 6s (Meta) — MIT License

The 4/6-stem separation model `htdemucs_6s.onnx` is downloaded at run time from
huggingface.co/kramp/htdemucs-6s-webgpu-onnx (MIT), a constant-folded copy of
huggingface.co/StemSplitio/htdemucs-6s-onnx (MIT), exported from HTDemucs by Meta Platforms
(https://github.com/facebookresearch/demucs, MIT; Rouard, Massa, Défossez, ICASSP 2023).
The overlap-add windowing follows the reference `infer.py` of that model repository.

## wasm-media-encoders — MIT License (includes LAME, LGPL)

MP3 encoding uses wasm-media-encoders (https://github.com/arseneyr/wasm-media-encoders, MIT),
which ships the LAME MP3 encoder (https://lame.sourceforge.io, LGPL-2.0) compiled to WebAssembly.
It is loaded as its own module, unmodified, so it can be replaced independently of the app.
