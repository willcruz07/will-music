# Completed analysis save recovery

Trigger: user reports a nine-minute song finishing with AbortError/QuotaExceededError and no rendered output. Code inspection: results were only read from IndexedDB; final-transaction refusal discarded calculated results. The error handler attempted another database write, potentially masking the initial error. Browser quota refusal root cause remains unconfirmed.

Implemented: retain small analysis/chart/song snapshots in memory before the final transaction; overlay them in Song on failure; visibly mark unsaved; retry the final transaction without running models; export the pending snapshot in the normal package. Preserve edited charts/user lyrics on retry. Keep local transpose/font/sync preferences, gate navigation to editors until saved, clear snapshots on successful save/deletion. Quota failures are not reported as durable success. Catch status-write errors without replacing the original error. Add storage diagnostics to the pending-result panel.

Progress: forward LV sub-block messages through worker/client/pipeline, without changing networks or inference outputs. No performance improvement claimed.

Validation: 44 related tests passed, including simulated quota refusal, pending rendering, package export, repeated failed retry and successful save without new inference, and original-error preservation. Typecheck and production build passed. No commit. No native browser reproduction of quota cause; earlier discarded runtime results cannot be recovered retroactively.
