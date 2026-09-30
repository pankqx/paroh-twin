# Browser voice helpers

`listen.ts` wraps browser speech recognition for live text transcription. It does not
record or store audio. An optional Web Audio meter reports a temporary 0–1 input level;
its microphone stream is stopped when recognition ends or `stop()` is called. Browser
speech recognition may send audio to the browser vendor's speech service.
`listen.start()` requests microphone permission explicitly, reports interim and final text
separately, and ends after about 1.8 seconds without speech. Auto-restart is off by default.
Use `listen.stop()` for immediate cancellation; it aborts recognition and always emits the
end callback. Brave may block the speech service; in that case use Chrome or type instead.

`speak.ts` queues sentence-sized speech synthesis utterances, publishes the active caption,
and persists the voice on/off choice in local storage. Its `mouth` value is an approximate
0–3 lip-sync cue derived from browser word-boundary events when available, with a timer
fallback; it is not phoneme-accurate. Call `speak()` from a user gesture. Both modules guard
browser APIs and can be imported during server rendering. Call `speak.cancel()` when the user
begins talking to stop queued speech immediately.
Speech voice gender and accent availability vary by device and browser; the selected twin
look is a best-effort preference, with en-IN preferred before en-GB and en-US.
