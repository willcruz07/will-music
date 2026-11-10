# Parallel chords and transcription

Approved: test two independent tasks together, optimize current models without replacing weights or changing chord smoothing. No automatic separation. No commits.

- [x] Add auto/parallel/sequential execution preference. Auto keeps iOS sequential and permits desktop overlap where GPU and CPU resources are available. Explicit parallel is a test override.
- [x] Coordinate two cancellable workers, independent progress and immediate failure handling. Publish chords while lyrics run; preserve user lyrics, edited charts and pending-save recovery. Resource-only transcription fallback retries once sequentially after chord worker finishes.
- [x] Reduce chord PCM copies, precompute Viterbi log probabilities with Float64 precision; preserve labels. Restrict Whisper full rerun to known timestamp-alignment incompatibility and release models deterministically.
- [x] Record processing durations, expose progress and settings, run controlled concurrency/failure regressions and real LV parity smoke.

Validation: deferred promises prove overlap and independent settlement; abort tests ensure no orphan worker. Native Safari/iPhone memory and elapsed-time benefits must be validated manually; no speed multiplier promised.

Validation results: 49 related web tests and 149 engine tests passed; typecheck and production PWA build passed. Real shared WASM inference preserved the 30-second reference labels and the standard worker covered a 65-second fixture continuously with SKey. Decoder-only benchmark on 1,292 frames: 0.337 s before, 0.124 s after, exactly the same 12 segments; no end-to-end speed multiplier inferred. User independently reported satisfactory processing latency in Chrome during implementation.

Follow-up logs: Vite connections are dev messages; powerPreference is a browser/runtime warning. Transformers cache QuotaExceededError is an actual persistence refusal. Its source explicitly logs and continues inference with the fetched bytes. Cache availability now requires both q4 networks and essential config/tokenizer files; preload does not report durable installation when only small metadata files were cached. Underlying browser-storage refusal remains unresolved; warnings were not globally silenced.

## Ajustes finais e revisão para produção — 2026-11-09

- Recuperação de resultados temporários ficou em uma seção recolhida “Salvar ou exportar resultado”; salvamento, exportação e diagnóstico foram preservados.
- Ao concluir letra e acordes, a página inicia separação de seis faixas se houver WebGPU compatível e ainda não houver seis faixas disponíveis. Os resultados de separação ficam na sessão (persist:false).
- A separação não começa após análise ou transcrição com erro. A confirmação de uso intensivo de memória no iPhone/iPad foi preservada; desmontar a página cancela a separação.
- Revisão independente encontrou e levou à correção do disparo indevido após erro de transcrição.
- Verificação: 18 testes direcionados passaram inicialmente; após correção da revisão, 13 testes de jobs, separação automática, tela e pipeline paralelo passaram. Typecheck e build de produção passaram. Aviso de chunk grande da partitura permanece.
- Limites para liberação: falhas reais de quota/cache continuam sem causa confirmada; resultado temporário e faixas da sessão não sobrevivem ao reload; iPhone/Safari físico ainda exige validação. Atualizar o PWA durante processamento ou com resultado temporário pode interromper trabalho, portanto validar esse fluxo antes da liberação ampla.
- Modelos LV em public/models/lv-chordia-v1 precisam integrar o commit/deploy, junto aos demais arquivos novos. Nenhum commit ou deploy foi realizado.
