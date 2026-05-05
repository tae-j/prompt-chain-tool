'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { HumorFlavor, HumorFlavorStep, HumorFlavorStepType, LlmInputType, LlmOutputType, LlmModel, Profile } from '@/lib/types'

type Theme = 'dark' | 'light' | 'system'

/* ─────────────────────────────────────────
   SAMPLE TEST IMAGES  (picsum.photos — free, always available)
───────────────────────────────────────── */
const SAMPLE_IMAGES = [
  { label: 'Coffee',   url: 'https://picsum.photos/id/431/600/450' },
  { label: 'Meeting',  url: 'https://picsum.photos/id/180/600/450' },
  { label: 'Outdoors', url: 'https://picsum.photos/id/169/600/450' },
  { label: 'City',     url: 'https://picsum.photos/id/318/600/450' },
  { label: 'Animals',  url: 'https://picsum.photos/id/200/600/450' },
]

const API_BASE = 'https://api.almostcrackd.ai'
const EP_REGISTER  = `${API_BASE}/pipeline/upload-image-from-url`
const EP_GENERATE  = `${API_BASE}/pipeline/generate-captions`

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3800); return () => clearTimeout(t) }, [onClose])
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'
  return <div className={`toast toast-${type}`}>{icon} {msg}</div>
}

/* ─────────────────────────────────────────
   THEME TOGGLE
───────────────────────────────────────── */
function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const opts: { key: Theme; label: string; icon: string }[] = [
    { key: 'dark',   label: 'Dark',  icon: '🌙' },
    { key: 'light',  label: 'Light', icon: '☀️' },
    { key: 'system', label: 'Auto',  icon: '💻' },
  ]
  return (
    <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-elevated)', borderRadius: '9px', padding: '3px' }}>
      {opts.map(o => (
        <button key={o.key} onClick={() => setTheme(o.key)} title={o.label} style={{
          padding: '4px 9px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          background: theme === o.key ? 'var(--accent)' : 'transparent',
          color: theme === o.key ? '#fff' : 'var(--text-muted)',
          fontSize: '12px', fontWeight: '600', transition: 'all 0.14s', fontFamily: 'Inter, sans-serif',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <span style={{ fontSize: '11px' }}>{o.icon}</span>
          <span style={{ fontSize: '10px', letterSpacing: '0.02em' }}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────
   FLAVOR MODAL
───────────────────────────────────────── */
function FlavorModal({ flavor, onSave, onClose }: {
  flavor: Partial<HumorFlavor> | null
  onSave: (d: Partial<HumorFlavor>) => void
  onClose: () => void
}) {
  const isEdit = !!flavor?.id
  const [form, setForm] = useState({ description: flavor?.description || '', slug: flavor?.slug || '' })
  function makeSlug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <div>
            <h2 style={{ margin: '0 0 2px', fontSize: '17px', fontWeight: '800' }}>
              {isEdit ? 'Edit Humor Flavor' : 'New Humor Flavor'}
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
              {isEdit ? 'Update description and slug' : 'A flavor defines the personality of a caption chain'}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 8px', fontSize: '16px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label>Description</label>
            <input className="input" value={form.description} onChange={e => {
              const d = e.target.value
              setForm(f => ({ ...f, description: d, slug: isEdit ? f.slug : makeSlug(d) }))
            }} placeholder="e.g. A chaotic energy Keke Palmer vibe" />
          </div>
          <div>
            <label>Slug</label>
            <input className="input" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}
              value={form.slug} onChange={e => setForm(f => ({ ...f, slug: makeSlug(e.target.value) }))}
              placeholder="keke-palmer" />
            <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Used as the API identifier. Auto-generated from description.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.description || !form.slug}>
            {isEdit ? 'Save Changes' : 'Create Flavor'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   STEP MODAL
───────────────────────────────────────── */
function StepModal({ step, flavorId, stepTypes, inputTypes, outputTypes, models, onSave, onClose }: {
  step: Partial<HumorFlavorStep> | null
  flavorId: number
  stepTypes: HumorFlavorStepType[]
  inputTypes: LlmInputType[]
  outputTypes: LlmOutputType[]
  models: LlmModel[]
  onSave: (d: Partial<HumorFlavorStep>) => void
  onClose: () => void
}) {
  const isEdit = !!step?.id
  const [form, setForm] = useState<Partial<HumorFlavorStep>>(step || {
    humor_flavor_id: flavorId,
    llm_temperature: 0.7,
    llm_system_prompt: '',
    llm_user_prompt: '',
    description: '',
    humor_flavor_step_type_id: null,
    llm_input_type_id: null,
    llm_output_type_id: null,
    llm_model_id: null,
  })
  function up(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })) }
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ padding: '28px', maxWidth: '560px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <div>
            <h2 style={{ margin: '0 0 2px', fontSize: '17px', fontWeight: '800' }}>
              {isEdit ? 'Edit Step' : 'Add Step'}
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
              Steps run in order to build the final caption
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 8px', fontSize: '16px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label>Description</label>
            <input className="input" value={form.description || ''} onChange={e => up('description', e.target.value)}
              placeholder="e.g. Extract key moment from image" />
          </div>
          <div>
            <label>Step Type</label>
            <select className="input" value={form.humor_flavor_step_type_id || ''}
              onChange={e => up('humor_flavor_step_type_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Select a type —</option>
              {stepTypes.map(st => (
                <option key={st.id} value={st.id}>
                  {st.slug}{st.description ? ` — ${st.description.slice(0, 48)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label>Input Type <span style={{ color: 'var(--danger-text)', fontWeight: '700' }}>*</span></label>
              <select className="input" value={form.llm_input_type_id || ''}
                onChange={e => up('llm_input_type_id', e.target.value ? Number(e.target.value) : null)}
                required>
                <option value="">— Required —</option>
                {inputTypes.map(t => <option key={t.id} value={t.id}>{t.slug}</option>)}
              </select>
            </div>
            <div>
              <label>Output Type <span style={{ color: 'var(--danger-text)', fontWeight: '700' }}>*</span></label>
              <select className="input" value={form.llm_output_type_id || ''}
                onChange={e => up('llm_output_type_id', e.target.value ? Number(e.target.value) : null)}
                required>
                <option value="">— Required —</option>
                {outputTypes.map(t => <option key={t.id} value={t.id}>{t.slug}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label>Model <span style={{ color: 'var(--text-muted)', fontWeight: '400', textTransform: 'none', fontSize: '11px', marginLeft: '4px' }}>(optional)</span></label>
            <select className="input" value={form.llm_model_id || ''}
              onChange={e => up('llm_model_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">— None —</option>
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label>
              Temperature
              <span style={{ color: 'var(--text-muted)', fontWeight: '400', textTransform: 'none', fontSize: '11px', marginLeft: '6px' }}>
                0–2, controls randomness
              </span>
            </label>
            <input className="input" type="number" step="0.1" min="0" max="2"
              value={form.llm_temperature ?? 0.7}
              onChange={e => up('llm_temperature', parseFloat(e.target.value))} />
          </div>
          <div>
            <label>System Prompt</label>
            <textarea className="input" rows={4} value={form.llm_system_prompt || ''}
              onChange={e => up('llm_system_prompt', e.target.value)}
              placeholder="You are a humor assistant. Be concise and funny." />
          </div>
          <div>
            <label>User Prompt</label>
            <textarea className="input" rows={4} value={form.llm_user_prompt || ''}
              onChange={e => up('llm_user_prompt', e.target.value)}
              placeholder="Describe this image. Use {{step_output}} to reference prior steps." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}
            disabled={!form.llm_input_type_id || !form.llm_output_type_id}>
            {isEdit ? 'Save Changes' : 'Add Step'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   CONFIRM MODAL
───────────────────────────────────────── */
function ConfirmModal({ msg, onConfirm, onClose }: { msg: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ padding: '28px', maxWidth: '400px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '14px' }}>🗑</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: '800' }}>Confirm Delete</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px', fontSize: '13.5px', lineHeight: 1.55 }}>{msg}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   TEST FLAVOR MODAL
   — 5 sample image thumbnails + manual URL
   — smart HTTP error classification (auth / request / server / notfound)
───────────────────────────────────────── */
/* ─────────────────────────────────────────
   Pipeline flow (matches jojo's working pattern):
     Step 1 → POST /pipeline/upload-image-from-url  { imageUrl, isCommonUse }  → imageId
     Step 2 → POST /pipeline/generate-captions       { imageId }               → captions
───────────────────────────────────────── */

function apiErr(endpoint: string, status: number, body: unknown): string {
  const msg = (body as Record<string, unknown>)?.message
           ?? (body as Record<string, unknown>)?.error
           ?? JSON.stringify(body)
  return `${endpoint}\n  HTTP ${status}: ${msg}`
}

function TestFlavorModal({ flavor, onGenerated, onClose }: {
  flavor: HumorFlavor
  onGenerated: (rawObjects: Array<Record<string, unknown>>, apiFlavorId: number | null) => void
  onClose: () => void
}) {
  const [imageUrl, setImageUrl]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [step, setStep]           = useState('')               // progress label
  const [captions, setCaptions]   = useState<string[]>([])
  const [imageId, setImageId]     = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<unknown>(null)
  const [showRaw, setShowRaw]     = useState(false)
  const [error, setError]         = useState('')
  const supabase = createClient()

  async function runTest() {
    if (!imageUrl.trim()) return
    setLoading(true); setError(''); setStep(''); setCaptions([]); setImageId(null); setRawResponse(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setError('No session token — sign out and back in, then retry.')
        setLoading(false); return
      }

      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

      /* ── Step 1: Register the image URL with the pipeline ── */
      setStep('Step 1/2 — registering image…')
      const regRes = await fetch(EP_REGISTER, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageUrl: imageUrl.trim(), isCommonUse: false }),
      })
      const regBody = await regRes.json().catch(() => ({}))

      if (!regRes.ok) {
        setError(apiErr(EP_REGISTER, regRes.status, regBody))
        setLoading(false); setStep(''); return
      }

      const imgId: string = regBody.imageId ?? regBody.id ?? regBody.image_id
      if (!imgId) {
        setError(`${EP_REGISTER}\n  Responded 200 but returned no imageId.\n  Raw: ${JSON.stringify(regBody)}`)
        setLoading(false); setStep(''); return
      }
      setImageId(imgId)

      /* ── Step 2: Generate captions ── */
      setStep('Step 2/2 — generating captions…')
      const genRes = await fetch(EP_GENERATE, {
        method: 'POST',
        headers,
        // Pass humor_flavor_id as an extra hint; the API may use it or ignore it
        body: JSON.stringify({ imageId: imgId }),
      })
      const genBody = await genRes.json().catch(() => ({}))

      if (!genRes.ok) {
        setError(apiErr(EP_GENERATE, genRes.status, genBody))
        setLoading(false); setStep(''); return
      }

      setRawResponse(genBody)

      /* Extract caption objects — handles array root or .captions array */
      const raw: unknown[] = Array.isArray(genBody)
        ? genBody
        : Array.isArray(genBody?.captions) ? genBody.captions
        : Array.isArray(genBody?.data)     ? genBody.data
        : [genBody]

      // Notify parent with raw objects so it can populate the Captions tab.
      // Pull the humor_flavor_id from the first caption to detect mismatches.
      const firstObj = raw[0] as Record<string, unknown> | undefined
      const apiFlavorId = typeof firstObj?.humor_flavor_id === 'number'
        ? firstObj.humor_flavor_id
        : null
      onGenerated(raw as Array<Record<string, unknown>>, apiFlavorId)

      setCaptions(
        raw.map((c: unknown) =>
          typeof c === 'string' ? c
          : (c as Record<string, unknown>)?.content as string
          ?? (c as Record<string, unknown>)?.caption_text as string
          ?? (c as Record<string, unknown>)?.text as string
          ?? JSON.stringify(c)
        )
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? `Network error: ${e.message}` : 'Unknown error')
    }

    setLoading(false); setStep('')
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ padding: '28px', maxWidth: '580px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: '0 0 3px', fontSize: '17px', fontWeight: '800' }}>Test Flavor</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>{flavor.slug}</code>
              {' — '}{flavor.description}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}
            style={{ padding: '4px 8px', fontSize: '16px', lineHeight: 1, flexShrink: 0, marginLeft: '12px' }}>×</button>
        </div>

        {/* Sample images */}
        <div style={{ marginBottom: '16px' }}>
          <label>Sample Test Images</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {SAMPLE_IMAGES.map(img => (
              <button key={img.url}
                className={`test-img-btn${imageUrl === img.url ? ' selected' : ''}`}
                onClick={() => setImageUrl(img.url)} title={img.label}>
                <img src={img.url} alt={img.label} />
                <span>{img.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Manual URL */}
        <div style={{ marginBottom: '14px' }}>
          <label>Or enter image URL</label>
          <input className="input" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg" />
        </div>

        {/* Preview */}
        {imageUrl && (
          <div style={{ marginBottom: '14px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', height: '150px', background: 'var(--bg-elevated)' }}>
            <img src={imageUrl} alt="preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
        )}

        {/* Generate button */}
        <button className="btn btn-primary" onClick={runTest}
          disabled={loading || !imageUrl.trim()}
          style={{ width: '100%', justifyContent: 'center', marginBottom: '14px', padding: '11px' }}>
          {loading
            ? <><span className="spinner" style={{ width: '15px', height: '15px' }} />{step || 'Working…'}</>
            : 'Generate Captions via API'}
        </button>

        {/* Error — pre-formatted so endpoint + status are readable */}
        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '9px', marginBottom: '14px', background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: '12px', lineHeight: 1.6 }}>
            <strong style={{ display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>⚠️ API Error</strong>
            <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '11.5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</pre>
          </div>
        )}

        {/* imageId badge */}
        {imageId && (
          <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Image registered:</span>
            <code style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-text)', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: '5px', padding: '2px 8px' }}>{imageId}</code>
          </div>
        )}

        {/* Captions */}
        {captions.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <label>Generated Captions ({captions.length})</label>
            <div style={{ display: 'grid', gap: '8px' }}>
              {captions.map((c, i) => (
                <div key={i} className="caption-card fade-in" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--accent-text)', fontWeight: '800', fontSize: '11px', marginTop: '2px', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>#{i + 1}</span>
                    <p style={{ margin: 0, lineHeight: 1.55, fontSize: '13px' }}>{c}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw response toggle */}
        {rawResponse != null && (
          <div>
            <button className="btn btn-ghost btn-xs" onClick={() => setShowRaw(v => !v)}
              style={{ fontSize: '11px', marginBottom: '8px' }}>
              {showRaw ? '▲ Hide' : '▼ Show'} raw response
            </button>
            {showRaw && (
              <pre style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', overflowX: 'auto', maxHeight: '240px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   STEP CARD
───────────────────────────────────────── */
function StepCard({ step, index, total, stepTypes, onEdit, onDelete, onMoveUp, onMoveDown }: {
  step: HumorFlavorStep; index: number; total: number; stepTypes: HumorFlavorStepType[]
  onEdit: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  const stepType = stepTypes.find(st => st.id === step.humor_flavor_step_type_id)
  return (
    <div className="step-card" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
      {/* Left: number + reorder */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', paddingTop: '1px' }}>
        <div className="step-number">{index + 1}</div>
        <button className="btn btn-ghost btn-xs" onClick={onMoveUp} disabled={index === 0}
          style={{ padding: '2px 5px', fontSize: '11px', opacity: index === 0 ? 0.25 : 0.7, minWidth: '26px' }}
          title="Move up">↑</button>
        <button className="btn btn-ghost btn-xs" onClick={onMoveDown} disabled={index === total - 1}
          style={{ padding: '2px 5px', fontSize: '11px', opacity: index === total - 1 ? 0.25 : 0.7, minWidth: '26px' }}
          title="Move down">↓</button>
      </div>

      {/* Center: content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '700', fontSize: '13.5px' }}>{step.description || `Step ${index + 1}`}</span>
          {stepType && <span className="badge badge-accent">{stepType.slug}</span>}
          {step.llm_temperature != null && <span className="badge badge-muted">temp {step.llm_temperature}</span>}
        </div>
        {step.llm_system_prompt && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>System</div>
            <div className="prompt-display" style={{ maxHeight: '64px', overflow: 'hidden' }}>{step.llm_system_prompt}</div>
          </div>
        )}
        {step.llm_user_prompt && (
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>User</div>
            <div className="prompt-display" style={{ maxHeight: '64px', overflow: 'hidden' }}>{step.llm_user_prompt}</div>
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit step">✏️</button>
        <button className="btn btn-danger btn-sm" onClick={onDelete} title="Delete step">🗑</button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   MAIN APP
───────────────────────────────────────── */
export default function AppPage() {
  const router   = useRouter()
  const supabase = createClient()

  /* ── Theme
     BUG FIX 1: read from localStorage after hydration
     BUG FIX 2: write data-theme attribute (not classList) + persist to localStorage
  ── */
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pct-theme') as Theme
      if (saved === 'dark' || saved === 'light' || saved === 'system') setTheme(saved)
    } catch { /* storage unavailable */ }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
    try { localStorage.setItem('pct-theme', theme) } catch {}
  }, [theme])

  /* ── Auth ── */
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  /* ── Data ── */
  const [flavors, setFlavors]               = useState<HumorFlavor[]>([])
  const [selectedFlavor, setSelectedFlavor] = useState<HumorFlavor | null>(null)
  const [steps, setSteps]                   = useState<HumorFlavorStep[]>([])
  const [stepTypes, setStepTypes]           = useState<HumorFlavorStepType[]>([])
  const [inputTypes, setInputTypes]         = useState<LlmInputType[]>([])
  const [outputTypes, setOutputTypes]       = useState<LlmOutputType[]>([])
  const [models, setModels]                 = useState<LlmModel[]>([])
  const [captions, setCaptions]             = useState<{ id: number; content: string; created_datetime_utc: string }[]>([])

  /* ── UI ── */
  const [view, setView]                   = useState<'steps' | 'captions'>('steps')
  const [search, setSearch]               = useState('')
  const [toast, setToast]                 = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [modal, setModal]                 = useState<'flavor' | 'step' | 'delete-flavor' | 'delete-step' | 'test' | null>(null)
  const [editingFlavor, setEditingFlavor] = useState<HumorFlavor | null>(null)
  const [editingStep, setEditingStep]     = useState<HumorFlavorStep | null>(null)
  const [deletingStepId, setDeletingStepId] = useState<number | null>(null)

  /* ── Loading ── */
  const [flavorsLoading,  setFlavorsLoading]  = useState(false)
  const [stepsLoading,    setStepsLoading]    = useState(false)
  const [captionsLoading,  setCaptionsLoading]  = useState(false)
  const [captionsError,    setCaptionsError]    = useState<string | null>(null)
  const [captionsMismatch, setCaptionsMismatch] = useState<string | null>(null)
  const [generatedFlavorIds, setGeneratedFlavorIds] = useState<number[]>([])
  // Maps selectedFlavor.id → API-returned humor_flavor_ids, persisted across flavor switches
  const [flavorIdMap, setFlavorIdMap] = useState<Record<number, number[]>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('pct-flavor-id-map') || '{}') } catch { return {} }
  })

  function showToast(msg: string, type: 'success' | 'error' | 'info' = 'success') { setToast({ msg, type }) }

  /* ── Auth check ── */
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof || (!prof.is_superadmin && !prof.is_matrix_admin)) {
        await supabase.auth.signOut(); router.replace('/login'); return
      }
      setProfile(prof); setAuthLoading(false)
    }
    checkAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Data loaders ── */
  const loadFlavors = useCallback(async () => {
    setFlavorsLoading(true)
    const { data } = await supabase.from('humor_flavors').select('*').order('created_datetime_utc', { ascending: false })
    setFlavors(data || []); setFlavorsLoading(false)
  }, [supabase])

  const loadStepTypes = useCallback(async () => {
    const { data } = await supabase.from('humor_flavor_step_types').select('*').order('id')
    setStepTypes(data || [])
  }, [supabase])

  const loadInputTypes = useCallback(async () => {
    const { data } = await supabase.from('llm_input_types').select('id, slug').order('slug')
    setInputTypes(data || [])
  }, [supabase])

  const loadOutputTypes = useCallback(async () => {
    const { data } = await supabase.from('llm_output_types').select('id, slug').order('slug')
    setOutputTypes(data || [])
  }, [supabase])

  const loadModels = useCallback(async () => {
    const { data } = await supabase.from('llm_models').select('id, name').order('name')
    setModels(data || [])
  }, [supabase])

  const loadSteps = useCallback(async (flavorId: number) => {
    setStepsLoading(true)
    const { data } = await supabase.from('humor_flavor_steps').select('*').eq('humor_flavor_id', flavorId).order('order_by')
    setSteps(data || []); setStepsLoading(false)
  }, [supabase])

  const loadCaptions = useCallback(async (flavorId: number) => {
    setCaptionsLoading(true)
    setCaptionsError(null)
    const { data, error } = await supabase.from('captions')
      .select('id, content, created_datetime_utc')
      .eq('humor_flavor_id', flavorId)
      .order('created_datetime_utc', { ascending: false })
      .limit(50)
    if (error) {
      setCaptionsError(`Supabase error (queried humor_flavor_id=${flavorId}): ${error.message}`)
      setCaptions([])
    } else {
      setCaptions(data || [])
    }
    setCaptionsLoading(false)
  }, [supabase])

  const loadCaptionsByIds = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return
    setCaptionsLoading(true)
    setCaptionsError(null)
    const { data, error } = await supabase.from('captions')
      .select('id, content, created_datetime_utc')
      .in('humor_flavor_id', ids)
      .order('created_datetime_utc', { ascending: false })
      .limit(50)
    if (error) {
      setCaptionsError(`Supabase error (queried humor_flavor_ids=[${ids.join(',')}]): ${error.message}`)
      setCaptions([])
    } else {
      setCaptions(data || [])
    }
    setCaptionsLoading(false)
  }, [supabase])

  useEffect(() => {
    if (!authLoading) {
      loadFlavors(); loadStepTypes(); loadInputTypes(); loadOutputTypes(); loadModels()
    }
  }, [authLoading, loadFlavors, loadStepTypes, loadInputTypes, loadOutputTypes, loadModels])

  /* ── Actions ── */
  function selectFlavor(f: HumorFlavor) {
    setSelectedFlavor(f); setView('steps'); loadSteps(f.id)
    // Restore previously-saved API flavor IDs for this flavor (if any)
    setGeneratedFlavorIds(flavorIdMap[f.id] ?? [])
    setCaptionsMismatch(null)
  }

  async function saveFlavor(data: Partial<HumorFlavor>) {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user.id
    if (editingFlavor?.id) {
      const { error } = await supabase.from('humor_flavors').update({
        ...data, modified_by_user_id: userId, modified_datetime_utc: new Date().toISOString(),
      }).eq('id', editingFlavor.id)
      if (error) { showToast(error.message, 'error'); return }
      if (selectedFlavor?.id === editingFlavor.id) setSelectedFlavor(s => s ? { ...s, ...data } : s)
      showToast('Flavor updated')
    } else {
      const { error } = await supabase.from('humor_flavors').insert({
        ...data, created_by_user_id: userId, modified_by_user_id: userId,
      })
      if (error) { showToast(error.message, 'error'); return }
      showToast('Flavor created')
    }
    loadFlavors(); setModal(null)
  }

  async function deleteFlavor() {
    if (!selectedFlavor) return
    await supabase.from('humor_flavor_steps').delete().eq('humor_flavor_id', selectedFlavor.id)
    await supabase.from('humor_flavors').delete().eq('id', selectedFlavor.id)
    showToast('Flavor deleted', 'info')
    setSelectedFlavor(null); setSteps([]); loadFlavors()
  }

  async function duplicateFlavor() {
    if (!selectedFlavor) return
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user.id

    // Build unique slug and description
    const baseSlug = `${selectedFlavor.slug}-copy`
    const baseDesc = `${selectedFlavor.description} Copy`
    const existingSlugs = new Set(flavors.map(f => f.slug))

    let newSlug = baseSlug
    let newDesc = baseDesc
    if (existingSlugs.has(newSlug)) {
      let n = 2
      while (existingSlugs.has(`${baseSlug}-${n}`)) n++
      newSlug = `${baseSlug}-${n}`
      newDesc = `${baseDesc} ${n}`
    }

    // Insert the new flavor
    const { data: newFlavor, error: flavorErr } = await supabase
      .from('humor_flavors')
      .insert({ description: newDesc, slug: newSlug, created_by_user_id: userId, modified_by_user_id: userId })
      .select()
      .single()

    if (flavorErr || !newFlavor) {
      showToast(flavorErr?.message || 'Failed to duplicate flavor', 'error')
      return
    }

    // Fetch the original steps in order
    const { data: originalSteps } = await supabase
      .from('humor_flavor_steps')
      .select('*')
      .eq('humor_flavor_id', selectedFlavor.id)
      .order('order_by')

    // Insert cloned steps pointing to the new flavor
    if (originalSteps && originalSteps.length > 0) {
      const cloned = originalSteps.map(s => ({
        humor_flavor_id: newFlavor.id,
        order_by: s.order_by,
        description: s.description,
        humor_flavor_step_type_id: s.humor_flavor_step_type_id,
        llm_temperature: s.llm_temperature,
        llm_input_type_id: s.llm_input_type_id,
        llm_output_type_id: s.llm_output_type_id,
        llm_model_id: s.llm_model_id,
        llm_system_prompt: s.llm_system_prompt,
        llm_user_prompt: s.llm_user_prompt,
        created_by_user_id: userId,
        modified_by_user_id: userId,
      }))
      const { error: stepsErr } = await supabase.from('humor_flavor_steps').insert(cloned)
      if (stepsErr) {
        showToast(`Flavor created but steps failed to copy: ${stepsErr.message}`, 'error')
        await loadFlavors()
        return
      }
    }

    showToast(`Duplicated as "${newDesc}"`, 'success')
    await loadFlavors()
    selectFlavor(newFlavor as HumorFlavor)
  }

  async function saveStep(data: Partial<HumorFlavorStep>) {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user.id
    if (editingStep?.id) {
      const { error } = await supabase.from('humor_flavor_steps').update({
        ...data, modified_by_user_id: userId, modified_datetime_utc: new Date().toISOString(),
      }).eq('id', editingStep.id)
      if (error) { showToast(error.message, 'error'); return }
      showToast('Step updated')
    } else {
      const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.order_by)) + 1 : 1
      const { error } = await supabase.from('humor_flavor_steps').insert({
        ...data, humor_flavor_id: selectedFlavor!.id, order_by: nextOrder,
        created_by_user_id: userId, modified_by_user_id: userId,
      })
      if (error) { showToast(error.message, 'error'); return }
      showToast('Step added')
    }
    loadSteps(selectedFlavor!.id); setModal(null)
  }

  async function deleteStep(id: number) {
    await supabase.from('humor_flavor_steps').delete().eq('id', id)
    showToast('Step deleted', 'info'); loadSteps(selectedFlavor!.id)
  }

  async function moveStep(index: number, dir: -1 | 1) {
    const arr = [...steps]
    const target = index + dir
    if (target < 0 || target >= arr.length) return
    const [a, b] = [arr[index], arr[target]]
    await supabase.from('humor_flavor_steps').update({ order_by: b.order_by }).eq('id', a.id)
    await supabase.from('humor_flavor_steps').update({ order_by: a.order_by }).eq('id', b.id)
    loadSteps(selectedFlavor!.id)
  }

  async function signOut() { await supabase.auth.signOut(); router.replace('/login') }

  /* Called by TestFlavorModal after successful generation. */
  function handleGenerated(
    rawObjects: Array<Record<string, unknown>>,
    _apiFlavorId: number | null
  ) {
    // Collect every unique humor_flavor_id returned by the API
    const ids = Array.from(new Set(
      rawObjects
        .map(c => c.humor_flavor_id)
        .filter((v): v is number => typeof v === 'number')
    ))
    const selectedId = selectedFlavor?.id ?? null

    setCaptionsMismatch(null)

    // Persist the mapping selectedFlavor.id → API ids in state + localStorage
    if (selectedId != null && ids.length > 0) {
      setFlavorIdMap(prev => {
        const next = { ...prev, [selectedId]: ids }
        try { localStorage.setItem('pct-flavor-id-map', JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
    }

    setGeneratedFlavorIds(ids)
    setView('captions')
    if (ids.length > 0) {
      loadCaptionsByIds(ids)
    } else {
      // Fallback: show API results directly if no IDs could be extracted
      setCaptions(
        rawObjects.map((c, i) => ({
          id: typeof c.id === 'number' ? c.id : i,
          content: typeof c.content === 'string' ? c.content : JSON.stringify(c),
          created_datetime_utc: typeof c.created_datetime_utc === 'string'
            ? c.created_datetime_utc
            : new Date().toISOString(),
        }))
      )
    }
  }

  const filteredFlavors = flavors.filter(f =>
    (f.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.slug || '').toLowerCase().includes(search.toLowerCase())
  )

  /* ── Auth loading screen ── */
  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 14px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Verifying access…</p>
      </div>
    </div>
  )

  /* ══════════════════════════════════════════
     MAIN LAYOUT
  ══════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: '288px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg-card)' }}>

        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>⛓️</div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '13.5px', lineHeight: 1.2, color: 'var(--text-primary)' }}>Prompt Chain Tool</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>AlmostCrackd Admin</div>
            </div>
          </div>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        {/* Search + new */}
        <div style={{ padding: '10px 10px 4px' }}>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search flavors…" style={{ fontSize: '12.5px', padding: '7px 11px' }} />
        </div>
        <div style={{ padding: '6px 10px 3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Flavors {!flavorsLoading && `(${filteredFlavors.length})`}
          </span>
          <button className="btn btn-primary btn-xs"
            onClick={() => { setEditingFlavor(null); setModal('flavor') }}>+ New</button>
        </div>

        {/* Flavor list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '3px 8px 10px' }}>
          {flavorsLoading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : filteredFlavors.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              {search ? `No matches for "${search}"` : 'No flavors yet — create one above'}
            </div>
          ) : filteredFlavors.map(f => (
            <button key={f.id}
              className={`sidebar-item${selectedFlavor?.id === f.id ? ' active' : ''}`}
              onClick={() => selectFlavor(f)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.description}</div>
                <div style={{
                  fontSize: '10.5px', fontFamily: 'JetBrains Mono, monospace', marginTop: '1px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: selectedFlavor?.id === f.id ? 'var(--accent-text)' : 'var(--text-muted)',
                  opacity: 0.8,
                }}>{f.slug}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>Signed in as admin</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {profile?.is_superadmin  && <span className="badge badge-accent"  style={{ fontSize: '9px', padding: '1px 6px' }}>Superadmin</span>}
                {profile?.is_matrix_admin && <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 6px' }}>Matrix Admin</span>}
              </div>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={signOut} style={{ fontSize: '10.5px', flexShrink: 0 }}>Sign out</button>
          </div>
        </div>
      </aside>

      {/* ── MAIN PANEL ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {!selectedFlavor ? (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '40px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>🎭</div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '800' }}>Select a Humor Flavor</h2>
              <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '13.5px', maxWidth: '340px', lineHeight: 1.55 }}>
                Pick a flavor from the sidebar to manage its prompt chain steps, view captions, or run a test.
              </p>
              <button className="btn btn-primary" onClick={() => { setEditingFlavor(null); setModal('flavor') }}>
                Create First Flavor
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Flavor header bar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--bg-card)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: '0 0 1px', fontSize: '15px', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFlavor.description}
                </h1>
                <code style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedFlavor.slug}
                </code>
              </div>

              {/* View toggle */}
              <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '3px', flexShrink: 0 }}>
                {(['steps', 'captions'] as const).map(v => (
                  <button key={v}
                    onClick={() => { setView(v); if (v === 'captions') { if (generatedFlavorIds.length > 0) loadCaptionsByIds(generatedFlavorIds); else loadCaptions(selectedFlavor.id) } }}
                    style={{
                      padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      background: view === v ? 'var(--accent)' : 'transparent',
                      color: view === v ? '#fff' : 'var(--text-muted)',
                      fontSize: '12px', fontWeight: '600', transition: 'all 0.14s',
                    }}>
                    {v === 'steps' ? '🔗 Steps' : '💬 Captions'}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditingFlavor(selectedFlavor); setModal('flavor') }}>✏️ Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={duplicateFlavor}>⎘ Duplicate</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal('test')}>🧪 Test</button>
                <button className="btn btn-danger btn-sm" onClick={() => setModal('delete-flavor')}>🗑</button>
              </div>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* STEPS */}
              {view === 'steps' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ margin: '0 0 2px', fontSize: '14.5px', fontWeight: '800' }}>Prompt Chain Steps</h2>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
                        {steps.length} step{steps.length !== 1 ? 's' : ''} — executed in sequence to produce captions
                      </p>
                    </div>
                    <button className="btn btn-primary btn-sm"
                      onClick={() => { setEditingStep(null); setModal('step') }}>+ Add Step</button>
                  </div>

                  {stepsLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                      <div className="spinner" style={{ margin: '0 auto' }} />
                    </div>
                  ) : steps.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 14px' }}>🔗</div>
                      <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '700' }}>No steps yet</p>
                      <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                        Add your first step to define how captions are generated.
                      </p>
                      <button className="btn btn-primary"
                        onClick={() => { setEditingStep(null); setModal('step') }}>Add First Step</button>
                    </div>
                  ) : (
                    <div>
                      {steps.map((step, i) => (
                        <div key={step.id} className="fade-in">
                          <StepCard step={step} index={i} total={steps.length} stepTypes={stepTypes}
                            onEdit={() => { setEditingStep(step); setModal('step') }}
                            onDelete={() => { setDeletingStepId(step.id); setModal('delete-step') }}
                            onMoveUp={() => moveStep(i, -1)}
                            onMoveDown={() => moveStep(i, 1)} />
                          {i < steps.length - 1 && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
                              <div style={{ width: '1px', height: '10px', background: 'var(--border-mid)' }} />
                              <div style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: 1 }}>▼</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CAPTIONS */}
              {view === 'captions' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ margin: '0 0 2px', fontSize: '14.5px', fontWeight: '800' }}>Generated Captions</h2>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
                        Latest 50 captions produced by this flavor
                      </p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { if (generatedFlavorIds.length > 0) loadCaptionsByIds(generatedFlavorIds); else loadCaptions(selectedFlavor.id) }}>↺ Refresh</button>
                  </div>

                  {/* Supabase query error */}
                  {captionsError && (
                    <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '9px', background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: '12px', lineHeight: 1.6 }}>
                      <strong style={{ display: 'block', marginBottom: '3px' }}>⚠️ Query Error</strong>
                      <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '11.5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{captionsError}</pre>
                    </div>
                  )}
                  {/* Flavor ID mismatch warning */}
                  {captionsMismatch && (
                    <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '9px', background: 'var(--warning-dim)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)', fontSize: '12px', lineHeight: 1.6 }}>
                      <strong style={{ display: 'block', marginBottom: '3px' }}>🔍 Debug: Flavor ID Mismatch</strong>
                      <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '11.5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{captionsMismatch}</pre>
                    </div>
                  )}

                  {captionsLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                      <div className="spinner" style={{ margin: '0 auto' }} />
                    </div>
                  ) : captions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 14px' }}>💬</div>
                      <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '700' }}>No captions yet</p>
                      <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                        Captions appear here after the API generates them for this flavor.
                      </p>
                      <button className="btn btn-primary btn-sm" onClick={() => setModal('test')}>🧪 Run a Test</button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {captions.map(c => (
                        <div key={c.id} className="caption-card fade-in">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
                            <p style={{ margin: 0, lineHeight: 1.55, fontSize: '13px' }}>{c.content}</p>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                              {new Date(c.created_datetime_utc).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </main>

      {/* ── MODALS ── */}
      {modal === 'flavor' && (
        <FlavorModal flavor={editingFlavor} onSave={saveFlavor} onClose={() => setModal(null)} />
      )}
      {modal === 'step' && selectedFlavor && (
        <StepModal step={editingStep} flavorId={selectedFlavor.id} stepTypes={stepTypes}
          inputTypes={inputTypes} outputTypes={outputTypes} models={models}
          onSave={saveStep} onClose={() => setModal(null)} />
      )}
      {modal === 'delete-flavor' && selectedFlavor && (
        <ConfirmModal
          msg={`Delete "${selectedFlavor.description}" and all its steps? This cannot be undone.`}
          onConfirm={deleteFlavor} onClose={() => setModal(null)} />
      )}
      {modal === 'delete-step' && deletingStepId != null && (
        <ConfirmModal
          msg="Delete this step? This cannot be undone."
          onConfirm={() => deleteStep(deletingStepId)} onClose={() => setModal(null)} />
      )}
      {modal === 'test' && selectedFlavor && (
        <TestFlavorModal
          flavor={selectedFlavor}
          onGenerated={handleGenerated}
          onClose={() => setModal(null)} />
      )}

      {/* ── TOAST ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
