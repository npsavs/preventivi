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
    setMsg('Tag eliminato')
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
          <select value={tagCatId} onChange={e => setTagCatId(e.target.value)} className="border rounded-lg px-3 py-2">
            <option value="">Categoria</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={tagNome} onChange={e => setTagNome(e.target.value)} placeholder="Nome tag" className="border rounded-lg px-3 py-2 flex-1 min-w-[120px]" />
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
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 ? <p className="text-sm text-slate-500">Nessun tag</p> : null}
          {tags.map(tg => (
            <div key={tg.id} className="flex items-center gap-1 rounded-lg px-2 py-1 text-white text-sm" style={{ backgroundColor: tg.color || '#64748b' }}>
              <span>{tg.name}</span>
              <span className="text-xs opacity-80">({nomeCat(tg.category_id)})</span>
              <button type="button" onClick={() => eliminaTag(tg.id)} className="ml-1 opacity-90 hover:opacity-100">×</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SezionePreventivi() {
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="font-semibold text-lg">Layout PDF preventivo</h2>
        <p className="text-sm text-slate-500">Prossimamente: posizione logo, intestazione, colonne tabella, colori.</p>
        <div className="grid gap-2 text-sm text-slate-400 border rounded-lg p-3 bg-slate-50">
          <p>• Logo e intestazione</p>
          <p>• Stile tabella prodotti</p>
          <p>• Piè di pagina e firme</p>
        </div>
      </section>
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="font-semibold text-lg">Numerazione</h2>
        <p className="text-sm text-slate-500">Prossimamente: prefisso, anno, contatore automatico.</p>
        <div className="grid gap-2 text-sm text-slate-400 border rounded-lg p-3 bg-slate-50">
          <p>• Formato numero (es. 00001/2026)</p>
          <p>• Reset annuale</p>
        </div>
      </section>
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="font-semibold text-lg">Testi predefiniti</h2>
        <p className="text-sm text-slate-500">Prossimamente: oggetto standard, note, condizioni.</p>
        <div className="grid gap-2 text-sm text-slate-400 border rounded-lg p-3 bg-slate-50">
          <p>• Oggetto di default</p>
          <p>• Note a piè preventivo</p>
          <p>• Condizioni di validità</p>
        </div>
      </section>
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="font-semibold text-lg">Sconti e IVA</h2>
        <p className="text-sm text-slate-500">Prossimamente: IVA predefinita, sconto riga / totale.</p>
      </section>
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
