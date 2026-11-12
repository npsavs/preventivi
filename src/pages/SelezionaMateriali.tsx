import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category, Material } from '../types'

export default function SelezionaMateriali() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [materialTags, setMaterialTags] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [catId, setCatId] = useState('')
  const [subId, setSubId] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [sel, setSel] = useState<Record<string, { qty: number; sconto: number; prezzo: number }>>({})

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data || []))
    supabase.from('subcategories').select('*').order('sort_order').then(({ data }) => setSubcategories(data || []))
    supabase.from('materials').select('*').order('name').then(({ data }) => setMaterials(data || []))
    supabase.from('tags').select('*').order('name').then(({ data }) => setTags(data || []))
    supabase.from('material_tags').select('*').then(({ data }) => setMaterialTags(data || []))
  }, [])

  function toggle(idMat: string) {
    setSel(prev => {
      const next = { ...prev }
      if (next[idMat]) delete next[idMat]
      else {
        const m = materials.find(x => x.id === idMat)
        next[idMat] = { qty: 1, sconto: 0, prezzo: Number(m?.unit_price || 0) }
      }
      return next
    })
  }

  function setQty(idMat: string, qty: number) {
    setSel(prev => ({ ...prev, [idMat]: { ...prev[idMat], qty: Math.max(1, qty) } }))
  }

  function setSconto(idMat: string, sconto: number) {
    setSel(prev => ({ ...prev, [idMat]: { ...prev[idMat], sconto: Math.max(0, Math.min(100, sconto)) } }))
  }

  function setPrezzo(idMat: string, prezzo: number) {
    setSel(prev => ({ ...prev, [idMat]: { ...prev[idMat], prezzo: Math.max(0, prezzo) } }))
  }

  function toggleFiltroTag(tid: string) {
    setTagIds(prev => prev.includes(tid) ? prev.filter(x => x !== tid) : [...prev, tid])
  }

  async function aggiungi() {
    if (!id) return
    const scelti = Object.entries(sel)
    if (scelti.length === 0) return alert('Seleziona almeno un prodotto')
    for (const [matId, opts] of scelti) {
      const m = materials.find(x => x.id === matId)
      if (!m) continue
      const base = opts.prezzo !== undefined ? Number(opts.prezzo) : Number(m.unit_price)
      const prezzo = base * (1 - opts.sconto / 100)
      await supabase.from('quote_items').insert({
        quote_id: id,
        material_id: m.id,
        name: m.name,
        description: (m.description || '') + (opts.sconto > 0 ? ' |PREZZO_ORIGINALE:' + base + '|SCONTO:' + opts.sconto : ''),
        image_url: m.image_url,
        quantity: opts.qty,
        unit: m.unit,
        unit_price: prezzo,
        is_discount: false,
      })
    }
    navigate('/preventivo/' + id)
  }

  const tagsVisibili = catId ? tags.filter(tg => tg.category_id === catId) : []

  const visibili = materials.filter(m => {
    if (catId && m.category_id !== catId) return false
    if (subId && (m as any).subcategory_id !== subId) return false
    if (tagIds.length > 0) {
      const suoi = materialTags.filter(x => x.material_id === m.id).map(x => x.tag_id)
      if (!tagIds.every(tid => suoi.includes(tid))) return false
    }
    const t = q.toLowerCase()
    if (t && !m.name.toLowerCase().includes(t) && !(m.description || '').toLowerCase().includes(t)) return false
    return true
  })
  const subsVisibili = subcategories.filter(s => !catId || s.category_id === catId)

  function tagsDi(materialId: string) {
    const ids = materialTags.filter(x => x.material_id === materialId).map(x => x.tag_id)
    return tags.filter(tg => ids.includes(tg.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Seleziona prodotti</h1>
        <div className="flex gap-2">
          <button type="button" onClick={aggiungi} className="bg-slate-900 text-white px-4 py-2 rounded-lg">Aggiungi selezionati ({Object.keys(sel).length})</button>
          <button type="button" onClick={() => navigate('/preventivo/' + id)} className="text-sm border px-3 py-1 rounded-lg">Torna</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl shadow">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca prodotto..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <button type="button" onClick={() => { setCatId(''); setSubId(''); setTagIds([]) }} className={'px-3 py-2 rounded-lg text-sm ' + (!catId ? 'bg-slate-900 text-white' : 'border')}>Tutte</button>
        {categories.map(c => (
          <button key={c.id} type="button" onClick={() => { setCatId(c.id); setSubId(''); setTagIds([]) }} className={'px-3 py-2 rounded-lg text-sm ' + (catId === c.id ? 'bg-slate-900 text-white' : 'border')}>{c.name}</button>
        ))}
      </div>
      {catId && subsVisibili.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSubId('')} className={'px-3 py-1 rounded-lg text-xs ' + (!subId ? 'bg-slate-700 text-white' : 'border')}>Tutte le sottocategorie</button>
          {subsVisibili.map(s => (
            <button key={s.id} type="button" onClick={() => setSubId(s.id)} className={'px-3 py-1 rounded-lg text-xs ' + (subId === s.id ? 'bg-slate-700 text-white' : 'border')}>{s.name}</button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-4 items-start">
        <aside className="w-44 shrink-0 sticky top-4 self-start">
          <div className="bg-white rounded-xl shadow p-3 space-y-2 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tag</p>
            {!catId ? (
              <p className="text-xs text-slate-400">Seleziona una categoria</p>
            ) : (
              <>
                <button type="button" onClick={() => setTagIds([])}
                  className={'w-full text-left px-2 py-1.5 rounded-lg text-sm border ' + (tagIds.length === 0 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white')}>
                  Tutti
                </button>
                {tagsVisibili.map(tg => {
                  const on = tagIds.includes(tg.id)
                  return (
                    <button key={tg.id} type="button" onClick={() => toggleFiltroTag(tg.id)}
                      className={'w-full text-left px-2 py-1.5 rounded-lg text-sm text-white flex items-center gap-2 ' + (on ? 'ring-2 ring-offset-1 ring-slate-900' : 'opacity-80')}
                      style={{ backgroundColor: tg.color || '#64748b' }}>
                      <span className={'w-3 h-3 rounded border shrink-0 ' + (on ? 'bg-white border-white' : 'border-white/70')} />
                      <span className="truncate">{tg.name}</span>
                    </button>
                  )
                })}
                {tagsVisibili.length === 0 ? <p className="text-xs text-slate-400">Nessun tag in questa categoria</p> : null}
              </>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0 bg-white rounded-xl shadow divide-y">
          {visibili.length === 0 ? <p className="p-4 text-sm text-slate-500">Nessun prodotto</p> : null}
          {visibili.map(m => {
            const s = sel[m.id]
            const tgs = tagsDi(m.id)
            return (
              <div key={m.id} className="p-3 flex flex-wrap items-center gap-3">
                <input type="checkbox" checked={!!s} onChange={() => toggle(m.id)} />
                {m.image_url ? <img src={m.image_url} alt="" className="h-10 w-10 object-contain" /> : null}
                <div className="flex-1 min-w-[140px]">
                  <p className="font-medium text-sm">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.unit} · listino EUR {Number((m as any).prezzo_listino || 0).toFixed(2)} · vendita EUR {Number(m.unit_price).toFixed(2)}</p>
                  {tgs.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tgs.map(tg => (
                        <span key={tg.id} className="text-xs text-white px-2 py-0.5 rounded" style={{ backgroundColor: tg.color }}>{tg.name}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {s ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <button type="button" onClick={() => setQty(m.id, s.qty - 1)} className="w-8 h-8 border rounded text-lg">−</button>
                    <span className="w-8 text-center">{s.qty}</span>
                    <button type="button" onClick={() => setQty(m.id, s.qty + 1)} className="w-8 h-8 border rounded text-lg">+</button>
                    <label className="text-xs font-semibold text-black">Vendita EUR</label>
                    <input type="number" step="0.01" value={s.prezzo} onChange={e => setPrezzo(m.id, Number(e.target.value))} className="w-24 border-2 border-slate-800 rounded px-2 py-1 text-sm font-semibold" />
                    <label className="text-xs">Sconto %</label>
                    <input type="number" min="0" max="100" value={s.sconto} onChange={e => setSconto(m.id, Number(e.target.value))} className="w-16 border rounded px-2 py-1 text-sm" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
