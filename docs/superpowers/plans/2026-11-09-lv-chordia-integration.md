# LV-Chordia standard analysis integration

Goal: use LV-Chordia for imported music, keep SKey and the existing lyric timeline. User approved implementation; no commits or push.

Architecture: pinned, same-origin static ONNX and gzip CQT plans, shared model cache. Analyze bounded 30-second cores with 5-second context on either side. Clip context outputs and merge contiguous identical labels. Existing generated charts rebuild through the pipeline; edited charts remain protected. Live microphone retains ChordMini on demand.

- [x] Package reproducible assets and hashes, register download/cache/settings/setup.
- [x] Extract shared LV inference, bounded song orchestration and interval stitching.
- [x] Replace analysis worker chords, retain key fallback and pipeline lyric sync.
- [x] Verify interval boundaries, cache behavior, types and production build; document browser checks.

Validation: injected clip analyzer exercises short/full songs, context clipping and time offsets without expensive model execution. Typecheck and production build ensure worker and static asset packaging. Browser musical accuracy and Safari memory remain manual validation.

Results: 47 targeted web tests and 149 engine tests passed; typecheck and production PWA build passed. Actual shared WASM inference matches the prior 30-second reference labels; standard worker covers 65-second repeated audio continuously, uses SKey and fetches 8 files once without ChordMini. Browser/mobile interaction remains for user validation.

Ruling: ship 100 tuning plans in a filtered ZIP rather than parse an inflated JSON bundle, reducing peak plan memory while retaining offline tuning. Standard package is 15,438,558 bytes plus 338,482 bytes SKey. Keep live microphone on legacy on-demand model. No commits or push.
