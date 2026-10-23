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
  const [q, setQ] = useState('')
  const [catId, setCatId] = useState('')
  const [subId, setSubId] = useState('')
  const [sel, setSel] = useState<Record<string, { qty: number; sconto: number }>>({})

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data || []))
    supabase.from('subcategories').select('*').order('sort_order').then(({ data }) => setSubcategories(data || []))
    supabase.from('materials').select('*').order('name').then(({ data }) => setMaterials(data || []))
  }, [])

  function toggle(id: string) {
    setSel(prev => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = { qty: 1, sconto: 0 }
      return next
    })
  }

  function setQty(id: string, qty: number) {
    setSel(prev => ({ ...prev, [id]: { ...prev[id], qty: Math.max(1, qty) } }))
  }

  function setSconto(id: string, sconto: number) {
    setSel(prev => ({ ...prev, [id]: { ...prev[id], sconto: Math.max(0, Math.min(100, sconto)) } }))
  }

  async function aggiungi() {
    if (!id) return
    const scelti = Object.entries(sel)
    if (scelti.length === 0) return alert('Seleziona almeno un prodotto')
    for (const [matId, opts] of scelti) {
      const m = materials.find(x => x.id === matId)
      if (!m) continue
      const prezzo = Number(m.unit_price) * (1 - opts.sconto / 100)
      await supabase.from('quote_items').insert({
        quote_id: id,
        material_id: m.id,
        name: m.name,
        description: (m.description || '') + (opts.sconto > 0 ? ' |PREZZO_ORIGINALE:' + m.unit_price + '|SCONTO:' + opts.sconto : ''),
        image_url: m.image_url,
        quantity: opts.qty,
        unit: m.unit,
        unit_price: prezzo,
        is_discount: false,
      })
    }
    navigate('/preventivo/' + id)
  }

  const visibili = materials.filter(m => {
    if (catId && m.category_id !== catId) return false
    if (subId && (m as any).subcategory_id !== subId) return false
    const t = q.toLowerCase()
    if (t && !m.name.toLowerCase().includes(t) && !(m.description || '').toLowerCase().includes(t)) return false
    return true
  })
  const subsVisibili = subcategories.filter(s => !catId || s.category_id === catId)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Seleziona prodotti</h1>
        <button type="button" onClick={() => navigate('/preventivo/' + id)} className="text-sm border px-3 py-1 rounded-lg">Torna al preventivo</button>
      </div>
      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl shadow">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca prodotto..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <button type="button" onClick={() => { setCatId(''); setSubId('') }} className={'px-3 py-2 rounded-lg text-sm ' + (!catId ? 'bg-slate-900 text-white' : 'border')}>Tutte</button>
        {categories.map(c => (
          <button key={c.id} type="button" onClick={() => { setCatId(c.id); setSubId('') }} className={'px-3 py-2 rounded-lg text-sm ' + (catId === c.id ? 'bg-slate-900 text-white' : 'border')}>{c.name}</button>
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
      <div className="bg-white rounded-xl shadow divide-y">
        {visibili.map(m => {
          const s = sel[m.id]
          return (
            <div key={m.id} className="p-3 flex flex-wrap items-center gap-3">
              <input type="checkbox" checked={!!s} onChange={() => toggle(m.id)} />
              {m.image_url ? <img src={m.image_url} alt="" className="h-10 w-10 object-contain" /> : null}
              <div className="flex-1 min-w-[140px]">
                <p className="font-medium text-sm">{m.name}</p>
                <p className="text-xs text-slate-500">{m.unit} · EUR {Number(m.unit_price).toFixed(2)}</p>
              </div>
              {s ? (
                <div className="flex gap-2 items-center">
                  <label className="text-xs">Qtà</label>
                  <input type="number" min="1" value={s.qty} onChange={e => setQty(m.id, Number(e.target.value))} className="w-16 border rounded px-2 py-1 text-sm" />
                  <label className="text-xs">Sconto %</label>
                  <input type="number" min="0" max="100" value={s.sconto} onChange={e => setSconto(m.id, Number(e.target.value))} className="w-16 border rounded px-2 py-1 text-sm" />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      <button type="button" onClick={aggiungi} className="bg-slate-900 text-white px-6 py-3 rounded-lg">Aggiungi selezionati ({Object.keys(sel).length})</button>
    </div>
  )
}
