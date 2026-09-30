# Browser voice helpers

`listen.ts` wraps browser speech recognition for live text transcription. It does not
record or store audio. An optional Web Audio meter reports a temporary 0–1 input level;
its microphone stream is stopped when recognition ends or `stop()` is called. Browser
speech recognition may send audio to the browser vendor's speech service.

`speak.ts` queues sentence-sized speech synthesis utterances, publishes the active caption,
and persists the voice on/off choice in local storage. Its `mouth` value is an approximate
0–3 lip-sync cue derived from browser word-boundary events when available, with a timer
fallback; it is not phoneme-accurate. Call `speak()` from a user gesture. Both modules guard
browser APIs and can be imported during server rendering.
