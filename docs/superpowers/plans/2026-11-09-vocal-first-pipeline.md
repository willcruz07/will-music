# Vocal-first analysis

Approved sequence: separation -> isolated-vocal transcription -> harmonic mix analysis -> chart assembly. No automatic lyrics lookup. Preserve user lyrics and edited charts. BPM/meter and OPFS migration excluded. No commits.

- [x] Share temporary compressed stems between pipeline, player and transcription, release when no job/view retains them.
- [x] Make separation persistence optional; pipeline and manual player separation keep new stems in the session, reuse existing stored stems.
- [x] Centralize sequencing in pipeline with visible stages, sequential harmonic decoding, original-audio fallback on unsupported devices/failures. Keep the existing iOS separation confirmation.
- [x] Remove lyrics search from the song UI; preserve manual paste/edit and explicit transcription.
- [x] Validate order, reuse, lifecycle, failure paths and lyric protection; typecheck/build.

Ruling: existing models stay unchanged. Process heavy stages sequentially and never automatically retry separation after pipeline failure. A failure in transcription does not discard valid chords; display a saved warning. Existing original-audio storage remains unchanged.

Validation: 54 related web tests passed; typecheck and production PWA build passed. Tests cover real session-to-transcription plumbing with worker/audio decoding shims and intro offsets, pipeline ordering, no lyrics lookup, harmonic source selection, fallback, edited chart/lyrics protection, binary storage compatibility, session release and no stem persistence. Musical quality, latency and mobile memory remain browser checks.

New automatic transcripts are marked source=transcription so explicit reanalysis can regenerate them. User-applied/manual lyrics survive. Existing legacy records remain readable and unchanged. New session tracks are compressed MP3s; only one harmonic track is decoded at a time. The original MP3 stays in IndexedDB; no OPFS migration and no rhythm model in this change.
