# Restore original-audio analysis

User reports about four minutes separating 91 blocks, three minutes transcribing 25 windows, then 18 chord blocks for a nine-minute track; separated playback seems to jump/accelerate. Revert mandatory separation ordering while keeping LV-Chordia and saved results.

Implemented: analyze original MP3 first, publish/save chord-only result before waiting for Whisper, then merge transcription into the generated chart. No automatic lyrics lookup or separation. Keep manual six-track separation and session sharing. Automatic transcription explicitly uses original audio; user-selected lyrics/edited charts survive. Default playback is original, reset per song; separated mix remains opt-in. Existing mixer corrects drift by seeking follower tracks, which may explain perceived jumps, but this audio issue has not been reproduced.

Performance: removes the separation stage and four-track harmonic decoding from automatic imports; no specific new total duration promised. LV network count and Whisper model remain unchanged. Original-audio chord results can differ from harmonic-stem results; saved analyses are not rewritten automatically.

Validation: 34 related tests passed, typecheck and production PWA build passed. Tests confirm original-first ordering, no separation/search, chord visibility before transcription and preservation/export/retry of unsaved results. Browser musical-quality/latency validation remains manual. No commit.
