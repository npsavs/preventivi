import { useEffect, useState } from 'react'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const COLORI = [
  { id: '#3b82f6', label: 'Blu' },
  { id: '#22c55e', label: 'Verde' },
  { id: '#eab308', label: 'Giallo' },
  { id: '#ef4444', label: 'Rosso' },
  { id: '#a855f7', label: 'Viola' },
  { id: '#f97316', label: 'Arancio' },
  { id: '#06b6d4', label: 'Azzurro' },
  { id: '#64748b', label: 'Grigio' },
]

const SEZIONI = [
  { id: 'materiali', label: 'Materiali' },
  { id: 'preventivi', label: 'Preventivi' },
  { id: 'generale', label: 'Generale' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return 'block w-full text-left px-3 py-2 rounded-lg text-sm ' + (isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-700')
}

export default function Impostazioni() {
  const { sezione } = useParams()
  const active = sezione || 'materiali'
  if (sezione && !SEZIONI.some(s => s.id === sezione)) {
    return <Navigate to="/impostazioni/materiali" replace />
  }
  if (!sezione) {
    return <Navigate to="/impostazioni/materiali" replace />
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Impostazioni</h1>
      <div className="flex gap-4 items-start">
        <aside className="w-48 shrink-0 sticky top-4">
          <nav className="bg-white rounded-xl shadow p-2 space-y-1">
            {SEZIONI.map(s => (
              <NavLink key={s.id} to={'/impostazioni/' + s.id} className={navClass}>{s.label}</NavLink>
            ))}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">
          {active === 'materiali' ? <SezioneMateriali /> : null}
          {active === 'preventivi' ? <SezionePreventivi /> : null}
          {active === 'generale' ? <SezioneGenerale /> : null}
        </div>
      </div>
    </div>
  )
}

function SezioneMateriali() {
  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [catNome, setCatNome] = useState('')
  const [subCatId, setSubCatId] = useState('')
  const [subNome, setSubNome] = useState('')
  const [tagCatId, setTagCatId] = useState('')
  const [tagNome, setTagNome] = useState('')
  const [tagColor, setTagColor] = useState('#3b82f6')
  const [editTagId, setEditTagId] = useState('')
  const [editTagNome, setEditTagNome] = useState('')
  const [editTagColor, setEditTagColor] = useState('#3b82f6')

  async function load() {
    const { data: c } = await supabase.from('categories').select('*').order('name')
    const { data: s } = await supabase.from('subcategories').select('*').order('sort_order')
    const { data: t } = await supabase.from('tags').select('*').order('name')
    setCategories(c || [])
    setSubcategories(s || [])
    setTags(t || [])
    if (!subCatId && c?.[0]) setSubCatId(c[0].id)
    if (!tagCatId && c?.[0]) setTagCatId(c[0].id)
  }

  useEffect(() => { load() }, [])

  async function creaCategoria() {
    if (!catNome.trim()) return alert('Scrivi il nome della categoria')
    const { error } = await supabase.from('categories').insert({ name: catNome.trim() })
    if (error) return alert(error.message)
    setCatNome('')
    setMsg('Categoria creata')
    load()
  }

  async function eliminaCategoria(id: string) {
    if (!confirm('Eliminare la categoria?')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) return alert(error.message)
    setMsg('Categoria eliminata')
    load()
  }

  async function rinominaCategoria(id: string, name: string) {
    if (!name.trim()) return
    const { error } = await supabase.from('categories').update({ name: name.trim() }).eq('id', id)
    if (error) return alert(error.message)
    load()
  }

  async function creaSottocategoria() {
    if (!subCatId) return alert('Scegli una categoria')
    if (!subNome.trim()) return alert('Scrivi il nome della sottocategoria')
    const { error } = await supabase.from('subcategories').insert({ category_id: subCatId, name: subNome.trim() })
    if (error) return alert(error.message)
    setSubNome('')
    setMsg('Sottocategoria creata')
    load()
  }

  async function eliminaSottocategoria(id: string) {
    if (!confirm('Eliminare la sottocategoria?')) return
    const { error } = await supabase.from('subcategories').delete().eq('id', id)
    if (error) return alert(error.message)
    setMsg('Sottocategoria eliminata')
    load()
  }

  async function rinominaSottocategoria(id: string, name: string) {
    if (!name.trim()) return
    const { error } = await supabase.from('subcategories').update({ name: name.trim() }).eq('id', id)
    if (error) return alert(error.message)
    load()
  }

  async function setScontoSub(id: string, sconto: number) {
    const sc = Math.max(0, Math.min(100, Number(sconto) || 0))
    const { error } = await supabase.from('subcategories').update({ sconto: sc }).eq('id', id)
    if (error) return alert(error.message)
    const { data: mats } = await supabase.from('materials').select('id, unit_price, prezzo_listino').eq('subcategory_id', id)
    let n = 0
    for (const m of mats || []) {
      const listino = Number((m as any).prezzo_listino || m.unit_price || 0)
      if (listino <= 0) continue
      const netto = Number((listino * (1 - sc / 100)).toFixed(2))
      await supabase.from('materials').update({ prezzo_listino: listino, prezzo_netto: netto }).eq('id', m.id)
      n++
    }
    setMsg('Sconto ' + sc + '% salvato. Netto aggiornato su ' + n + ' prodotti.')
    load()
  }

  async function creaTag() {
    if (!tagCatId) return alert('Scegli una categoria per il tag')
    if (!tagNome.trim()) return alert('Scrivi il nome del tag')
    const { error } = await supabase.from('tags').insert({ name: tagNome.trim(), color: tagColor, category_id: tagCatId })
    if (error) return alert(error.message)
    setTagNome('')
    setMsg('Tag creato')
    load()
  }

  async function eliminaTag(id: string) {
    if (!confirm('Eliminare questo tag?')) return
    await supabase.from('material_tags').delete().eq('tag_id', id)
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) return alert(error.message)
    if (editTagId === id) setEditTagId('')
    setMsg('Tag eliminato')
    load()
  }

  function avviaModificaTag(tg: any) {
    setEditTagId(tg.id)
    setEditTagNome(tg.name || '')
    setEditTagColor(tg.color || '#3b82f6')
  }

  async function salvaModificaTag() {
    if (!editTagId) return
    if (!editTagNome.trim()) return alert('Nome tag obbligatorio')
    const { error } = await supabase.from('tags').update({
      name: editTagNome.trim(),
      color: editTagColor,
    }).eq('id', editTagId)
    if (error) return alert(error.message)
    setEditTagId('')
    setMsg('Tag aggiornato')
    load()
  }

  const nomeCat = (id: string) => categories.find(c => c.id === id)?.name || '-'

  return (
    <div className="space-y-6">
      {msg ? <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p> : null}

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Categorie</h2>
        <p className="text-sm text-slate-500">Usate in Materiali per organizzare i prodotti.</p>
        <div className="flex flex-wrap gap-2">
          <input value={catNome} onChange={e => setCatNome(e.target.value)} placeholder="Nome nuova categoria" className="border rounded-lg px-3 py-2 flex-1 min-w-[160px]" />
          <button type="button" onClick={creaCategoria} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Aggiungi categoria</button>
        </div>
        <div className="divide-y border rounded-lg">
          {categories.length === 0 ? <p className="p-3 text-sm text-slate-500">Nessuna categoria</p> : null}
          {categories.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 p-3">
              <input defaultValue={c.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== c.name) rinominaCategoria(c.id, e.target.value) }} className="border rounded px-2 py-1 flex-1 min-w-[140px]" />
              <button type="button" onClick={() => eliminaCategoria(c.id)} className="text-sm text-red-600">Elimina</button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Sottocategorie</h2>
        <p className="text-sm text-slate-500">Sconto % sul listino per calcolare il netto.</p>
        <div className="flex flex-wrap gap-2">
          <select value={subCatId} onChange={e => setSubCatId(e.target.value)} className="border rounded-lg px-3 py-2">
            <option value="">Categoria</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={subNome} onChange={e => setSubNome(e.target.value)} placeholder="Nome sottocategoria" className="border rounded-lg px-3 py-2 flex-1 min-w-[140px]" />
          <button type="button" onClick={creaSottocategoria} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Aggiungi sottocategoria</button>
        </div>
        <div className="divide-y border rounded-lg">
          {subcategories.length === 0 ? <p className="p-3 text-sm text-slate-500">Nessuna sottocategoria</p> : null}
          {subcategories.map(s => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 p-3">
              <span className="text-xs text-slate-400 w-28 truncate">{nomeCat(s.category_id)}</span>
              <input defaultValue={s.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== s.name) rinominaSottocategoria(s.id, e.target.value) }} className="border rounded px-2 py-1 flex-1 min-w-[120px]" />
              <label className="text-xs text-slate-500">Sconto %</label>
              <input type="number" min="0" max="100" step="0.1" defaultValue={Number(s.sconto || 0)} id={'sc-' + s.id} className="w-16 border rounded px-2 py-1 text-sm" />
              <button type="button" onClick={() => {
                const el = document.getElementById('sc-' + s.id) as HTMLInputElement
                setScontoSub(s.id, Number(el?.value || 0))
              }} className="text-xs bg-slate-800 text-white px-2 py-1 rounded">Applica</button>
              <button type="button" onClick={() => eliminaSottocategoria(s.id)} className="text-sm text-red-600">Elimina</button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Tag</h2>
        <p className="text-sm text-slate-500">Ogni tag appartiene a una sola categoria. In Materiali filtri e assegni ai prodotti.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={tagCatId} onChange={e => { setTagCatId(e.target.value); setEditTagId('') }} className="border rounded-lg px-3 py-2">
            <option value="">Scegli categoria (filtra elenco)</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={tagNome} onChange={e => setTagNome(e.target.value)} placeholder="Nome nuovo tag" className="border rounded-lg px-3 py-2 flex-1 min-w-[120px]" />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-slate-500">Colore riquadro:</span>
          {COLORI.map(c => (
            <button key={c.id} type="button" onClick={() => setTagColor(c.id)} title={c.label}
              className={'w-8 h-8 rounded border-2 ' + (tagColor === c.id ? 'border-slate-900 scale-110' : 'border-transparent')}
              style={{ backgroundColor: c.id }} />
          ))}
          <input type="color" value={tagColor} onChange={e => setTagColor(e.target.value)} className="w-10 h-8 border rounded cursor-pointer" title="Colore personalizzato" />
          <button type="button" onClick={creaTag} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Aggiungi tag</button>
        </div>
        <p className="text-sm text-slate-500">Elenco filtrato per la categoria selezionata sopra{tagCatId ? ': ' + nomeCat(tagCatId) : ''}.</p>
        {!tagCatId ? <p className="text-sm text-amber-700">Seleziona una categoria per vedere e gestire i suoi tag.</p> : null}
        <div className="flex flex-wrap gap-2">
          {tagCatId && tags.filter(tg => tg.category_id === tagCatId).length === 0 ? (
            <p className="text-sm text-slate-500">Nessun tag in questa categoria</p>
          ) : null}
          {tags.filter(tg => !tagCatId || tg.category_id === tagCatId).map(tg => (
            editTagId === tg.id ? (
              <div key={tg.id} className="w-full border rounded-lg p-3 space-y-2 bg-slate-50">
                <input value={editTagNome} onChange={e => setEditTagNome(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Nome tag" />
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-slate-500">Colore:</span>
                  {COLORI.map(c => (
                    <button key={c.id} type="button" onClick={() => setEditTagColor(c.id)} title={c.label}
                      className={'w-7 h-7 rounded border-2 ' + (editTagColor === c.id ? 'border-slate-900' : 'border-transparent')}
                      style={{ backgroundColor: c.id }} />
                  ))}
                  <input type="color" value={editTagColor} onChange={e => setEditTagColor(e.target.value)} className="w-9 h-7 border rounded" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={salvaModificaTag} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm">Salva</button>
                  <button type="button" onClick={() => setEditTagId('')} className="border px-3 py-1.5 rounded-lg text-sm">Annulla</button>
                </div>
              </div>
            ) : (
              <div key={tg.id} className="flex items-center gap-1 rounded-lg px-2 py-1 text-white text-sm" style={{ backgroundColor: tg.color || '#64748b' }}>
                <span>{tg.name}</span>
                <button type="button" onClick={() => avviaModificaTag(tg)} className="ml-1 text-xs underline opacity-90">Modifica</button>
                <button type="button" onClick={() => eliminaTag(tg.id)} className="ml-1 opacity-90 hover:opacity-100">×</button>
              </div>
            )
          ))}
        </div>
      </section>
    </div>
  )
}

function SezionePreventivi() {
  const DEFAULT = {
    ragione_sociale: 'Nuovo Punto Sicurezza snc',
    indirizzo: 'Via Claudia 48A',
    cap_citta: '00062 Bracciano (RM)',
    piva: '05678201004',
    telefoni: '3386379818 / 3386379820',
    email: 'nuovopuntosicurezza@gmail.com',
    sito: 'www.nuovopuntosicurezza.com',
    oggetto_default: '',
    note_default: `NUOVO PUNTO SICUREZZA SNC E' CERTIFICATA AJAX SU LINEA BASIC SUPERIOR E FIBRA.`,
    validita_giorni: '30',
    iva_default: '22',
    prefisso_numero: '',
    email_oggetto: 'Preventivo richiesto',
    email_corpo: 'Buongiorno,\n\nin allegato il preventivo richiesto.\n\nCordiali saluti\nNuovo Punto Sicurezza',
    mostra_firme: true,
    testo_firma_cliente: 'Firma cliente per accettazione',
    testo_firma_emittente: 'Firma emittente',
  }
  const [f, setF] = useState({ ...DEFAULT })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'preventivi').maybeSingle()
        if (data?.value && typeof data.value === 'object') {
          setF(prev => ({ ...prev, ...data.value }))
          return
        }
      } catch {}
      try {
        const raw = localStorage.getItem('nps_preventivi_settings')
        if (raw) setF(prev => ({ ...prev, ...JSON.parse(raw) }))
      } catch {}
    }
    load()
  }, [])

  function set(k: string, v: any) {
    setF(prev => ({ ...prev, [k]: v }))
  }

  async function salva() {
    setBusy(true)
    setMsg('')
    try {
      localStorage.setItem('nps_preventivi_settings', JSON.stringify(f))
      const { error } = await supabase.from('app_settings').upsert({ key: 'preventivi', value: f }, { onConflict: 'key' })
      if (error) {
        setMsg('Salvato in locale. Su Supabase: ' + error.message + ' (esegui lo SQL se manca la tabella)')
      } else {
        setMsg('Impostazioni preventivi salvate')
      }
    } catch (e: any) {
      setMsg('Errore: ' + (e.message || e))
    }
    setBusy(false)
  }

  return (
    <div className="space-y-6">
      {msg ? <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p> : null}

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Dati azienda sul preventivo</h2>
        <p className="text-sm text-slate-500">Compariranno in intestazione e piè di pagina del PDF.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Ragione sociale</label>
            <input value={f.ragione_sociale} onChange={e => set('ragione_sociale', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-slate-500">P.IVA</label>
            <input value={f.piva} onChange={e => set('piva', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Indirizzo</label>
            <input value={f.indirizzo} onChange={e => set('indirizzo', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-slate-500">CAP e città</label>
            <input value={f.cap_citta} onChange={e => set('cap_citta', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Telefoni</label>
            <input value={f.telefoni} onChange={e => set('telefoni', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Email</label>
            <input value={f.email} onChange={e => set('email', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500">Sito web</label>
            <input value={f.sito} onChange={e => set('sito', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Testi predefiniti</h2>
        <div>
          <label className="text-xs text-slate-500">Oggetto di default (nuovo preventivo)</label>
          <input value={f.oggetto_default} onChange={e => set('oggetto_default', e.target.value)} placeholder="Es. PREVENTIVO IMPIANTO DI ALLARME" className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Note a piè di pagina (default)</label>
          <textarea value={f.note_default} onChange={e => set('note_default', e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Validità preventivo (giorni)</label>
            <input type="number" min="1" value={f.validita_giorni} onChange={e => set('validita_giorni', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-slate-500">IVA % predefinita</label>
            <input type="number" min="0" max="100" step="0.1" value={f.iva_default} onChange={e => set('iva_default', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Numerazione</h2>
        <p className="text-sm text-slate-500">Prefisso opzionale davanti al numero (es. PRV-). Il contatore resta gestito dall&apos;app.</p>
        <div>
          <label className="text-xs text-slate-500">Prefisso numero</label>
          <input value={f.prefisso_numero} onChange={e => set('prefisso_numero', e.target.value)} placeholder="Es. PRV-" className="w-full border rounded-lg px-3 py-2 max-w-xs" />
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Email di invio</h2>
        <p className="text-sm text-slate-500">Usato quando apri il cliente di posta dal preventivo.</p>
        <div>
          <label className="text-xs text-slate-500">Oggetto email</label>
          <input value={f.email_oggetto} onChange={e => set('email_oggetto', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Corpo email</label>
          <textarea value={f.email_corpo} onChange={e => set('email_corpo', e.target.value)} rows={5} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-lg">Layout stampa</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!f.mostra_firme} onChange={e => set('mostra_firme', e.target.checked)} />
          Mostra riquadri firma cliente / emittente
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Testo firma cliente</label>
            <input value={f.testo_firma_cliente} onChange={e => set('testo_firma_cliente', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Testo firma emittente</label>
            <input value={f.testo_firma_emittente} onChange={e => set('testo_firma_emittente', e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
      </section>

      <button type="button" disabled={busy} onClick={salva} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg disabled:opacity-50">
        {busy ? 'Salvataggio...' : 'Salva impostazioni preventivi'}
      </button>
    </div>
  )
}

function SezioneGenerale() {
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="font-semibold text-lg">Dati azienda</h2>
        <p className="text-sm text-slate-500">Prossimamente: ragione sociale, indirizzo, P.IVA, telefono, email usati nei PDF.</p>
        <div className="grid gap-2 text-sm text-slate-400 border rounded-lg p-3 bg-slate-50">
          <p>• Ragione sociale e indirizzo</p>
          <p>• P.IVA / CF</p>
          <p>• Telefoni e email</p>
          <p>• Logo aziendale</p>
        </div>
      </section>
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="font-semibold text-lg">Preferenze app</h2>
        <p className="text-sm text-slate-500">Prossimamente: pagina iniziale, filtri di default, tema.</p>
      </section>
    </div>
  )
}
