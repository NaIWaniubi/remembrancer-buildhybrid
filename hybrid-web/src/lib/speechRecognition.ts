// On-device real-time transcription via the browser Web Speech API
// (SpeechRecognition / webkitSpeechRecognition).
//
// This is the PRIMARY channel of the degraded production route:
// no API key, no quota, no Gemini dependency — it runs in Chrome/Edge.
// It is wrapped behind a clean interface so the app degrades gracefully on
// browsers without support (Firefox/Safari) by switching to typed/paste mode.

export type RecognitionState = 'idle' | 'starting' | 'listening' | 'stopping' | 'unsupported'

export interface LiveTranscript {
  finalText: string // committed sentences
  interimText: string // partial hypothesis currently being heard
}

export interface SpeechEngineOptions {
  lang?: string // BCP-47, e.g. 'zh-CN' or 'en-US'
  onResult?: (t: LiveTranscript) => void
  onStateChange?: (state: RecognitionState) => void
  onError?: (message: string, fatal: boolean) => void
}

type AnyRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: ((event: any) => void) | null
  onstart: ((event: any) => void) | null
}

function resolveConstructor(): { new (): AnyRecognition } | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => AnyRecognition
    webkitSpeechRecognition?: new () => AnyRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return resolveConstructor() !== null
}

export class SpeechEngine {
  private rec: AnyRecognition | null = null
  private finalText = ''
  private state: RecognitionState = 'idle'
  private opts: Required<SpeechEngineOptions>
  private autoRestart = false
  private userStopped = false

  constructor(opts: SpeechEngineOptions = {}) {
    this.opts = {
      lang: opts.lang ?? 'auto',
      onResult: opts.onResult ?? (() => {}),
      onStateChange: opts.onStateChange ?? (() => {}),
      onError: opts.onError ?? (() => {})
    }

    const Ctor = resolveConstructor()
    if (!Ctor) {
      this.setState('unsupported')
      return
    }

    this.rec = new Ctor()
    this.rec.lang = this.resolveLang()
    this.rec.continuous = true
    this.rec.interimResults = true
    this.rec.maxAlternatives = 1

    this.rec.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          const trimmed = text.trim()
          if (trimmed) this.finalText += (this.finalText ? ' ' : '') + trimmed
        } else {
          interim += text
        }
      }
      this.opts.onResult({ finalText: this.finalText, interimText: interim.trim() })
    }

    this.rec.onerror = (event: any) => {
      const err = String(event?.error ?? 'unknown')
      const fatal = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture'].includes(err)
      if (fatal) this.autoRestart = false
      this.opts.onError(err, fatal)
    }

    this.rec.onend = () => {
      // Chrome stops after silence; restart while the user still intends to record.
      if (this.autoRestart && !this.userStopped) {
        try {
          this.rec?.start()
        } catch {
          /* already started — ignore */
        }
        return
      }
      this.userStopped = false
      this.setState(this.finalText ? 'idle' : 'idle')
    }
  }

  private resolveLang(): string {
    return this.opts.lang === 'auto' ? navigator.language || 'zh-CN' : this.opts.lang
  }

  get currentLanguage(): string {
    return this.rec?.lang ?? ''
  }

  async start(): Promise<void> {
    if (!this.rec) {
      this.opts.onError('speech-recognition-unsupported', true)
      return
    }
    this.finalText = ''
    this.userStopped = false
    this.autoRestart = true
    this.setState('starting')
    try {
      this.rec.start()
      this.setState('listening')
    } catch (err) {
      // InvalidStateError means it's already running — treat as success
      this.setState('listening')
    }
  }

  stop(): LiveTranscript {
    if (this.rec) {
      this.autoRestart = false
      this.userStopped = true
      this.setState('stopping')
      try {
        this.rec.stop()
      } catch {
        /* ignore */
      }
    }
    const out = { finalText: this.finalText, interimText: '' }
    this.setState('idle')
    return out
  }

  get text(): string {
    return this.finalText
  }

  get supported(): boolean {
    return this.rec !== null
  }

  private setState(state: RecognitionState) {
    this.state = state
    this.opts.onStateChange(state)
  }

  get state_(): RecognitionState {
    return this.state
  }
}