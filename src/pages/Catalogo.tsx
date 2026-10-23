import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category, Material } from '../types'

export default function Catalogo() {
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [q, setQ] = useState('')
  const catFromUrl = new URLSearchParams(window.location.search).get('cat')
  const [catId, setCatId] = useState(catFromUrl || '')
  const [subId, setSubId] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: c } = await supabase.from('categories').select('*').order('name')
    const { data: s } = await supabase.from('subcategories').select('*').order('sort_order')
    const { data: m } = await supabase.from('materials').select('*').order('name')
    setCategories(c || [])
    setSubcategories(s || [])
    setMaterials((m || []) as Material[])
  }

  async function addCategory() {
    const nome = prompt('Nome della nuova categoria')
    if (!nome || !nome.trim()) return
    const { error } = await supabase.from('categories').insert({ name: nome.trim() })
    if (error) return alert(error.message)
    load()
  }

  async function addSubcategory() {
    if (!catId) return alert('Seleziona prima una categoria')
    const nome = prompt('Nome della nuova sottocategoria')
    if (!nome || !nome.trim()) return
    const { error } = await supabase.from('subcategories').insert({ category_id: catId, name: nome.trim() })
    if (error) return alert(error.message)
    load()
  }

  async function renameCategory(id: string, name: string) {
    const { error } = await supabase.from('categories').update({ name }).eq('id', id)
    if (error) alert(error.message)
    else { setMsg('Categoria aggiornata'); load() }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Eliminare la categoria e i prodotti dentro?')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) alert(error.message)
    else load()
  }

  async function spostaSub(id: string, dir: number) {
    const dellaCat = subcategories.filter(s => s.category_id === subcategories.find(x => x.id === id)?.category_id)
    const idx = dellaCat.findIndex(s => s.id === id)
    const altroIdx = idx + dir
    if (altroIdx < 0 || altroIdx >= dellaCat.length) return
    const a = dellaCat[idx]
    const b = dellaCat[altroIdx]
    const ordA = a.sort_order ?? idx * 10
    const ordB = b.sort_order ?? altroIdx * 10
    await supabase.from('subcategories').update({ sort_order: ordB }).eq('id', a.id)
    await supabase.from('subcategories').update({ sort_order: ordA }).eq('id', b.id)
    load()
  }

  async function deleteSubcategory(id: string) {
    if (!confirm('Eliminare la sottocategoria?')) return
    await supabase.from('subcategories').delete().eq('id', id)
    load()
  }

  async function deleteMaterial(id: string) {
    if (!confirm('Eliminare questo prodotto?')) return
    await supabase.from('materials').delete().eq('id', id)
    load()
  }

  const cats = catId ? categories.filter(c => c.id === catId) : categories
  const subs = subcategories.filter(s => !catId || s.category_id === catId)
  const match = (m: Material) => {
    const t = q.toLowerCase()
    if (!t) return true
    return m.name.toLowerCase().includes(t) || String(m.description || '').toLowerCase().includes(t)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-2xl font-bold">Catalogo materiali</h1>
        <div className="flex gap-2">
          <button type="button" onClick={addCategory} className="border px-4 py-2 rounded-lg text-sm">+ Categoria</button>
          <button type="button" onClick={addSubcategory} className="border px-4 py-2 rounded-lg text-sm">+ Sottocategoria</button>
          <Link to={'/materiale/nuovo' + (catId ? '?cat=' + catId : '') + (subId ? '&sub=' + subId : '')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">+ Nuovo prodotto</Link>
        </div>
      </div>
      {msg ? <p className="text-green-700 text-sm">{msg}</p> : null}

      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl shadow">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca prodotto..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <button type="button" onClick={() => { setCatId(''); setSubId('') }} className={'px-3 py-2 rounded-lg text-sm ' + (!catId ? 'bg-slate-900 text-white' : 'border')}>Tutte</button>
        {categories.map(c => (
          <button key={c.id} type="button" onClick={() => { setCatId(c.id); setSubId('') }} className={'px-3 py-2 rounded-lg text-sm ' + (catId === c.id ? 'bg-slate-900 text-white' : 'border')}>{c.name}</button>
        ))}
      </div>
      {catId && subs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSubId('')} className={'px-3 py-1 rounded-lg text-xs ' + (!subId ? 'bg-slate-700 text-white' : 'border')}>Tutte le sottocategorie</button>
          {subs.map(s => (
            <button key={s.id} type="button" onClick={() => setSubId(s.id)} className={'px-3 py-1 rounded-lg text-xs ' + (subId === s.id ? 'bg-slate-700 text-white' : 'border')}>{s.name}</button>
          ))}
        </div>
      ) : null}

      {cats.map(cat => (
        <div key={cat.id} className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex gap-2">
            <input defaultValue={cat.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== cat.name) renameCategory(cat.id, e.target.value.trim()) }} className="font-semibold border rounded px-2 py-1 flex-1" />
            <button type="button" onClick={() => deleteCategory(cat.id)} className="text-sm text-red-600">Elimina categoria</button>
          </div>
          {subcategories.filter(s => s.category_id === cat.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(s => (
            <div key={s.id} className="ml-4 border-l-2 pl-3">
              <div className="flex justify-between text-sm items-center">
                <input defaultValue={s.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== s.name) renameSub(s.id, e.target.value) }} className="font-medium text-slate-600 border rounded px-2 py-0.5 text-sm" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => spostaSub(s.id, -1)} className="text-xs text-slate-500">↑</button>
                  <button type="button" onClick={() => spostaSub(s.id, 1)} className="text-xs text-slate-500">↓</button>
                  <button type="button" onClick={() => deleteSubcategory(s.id)} className="text-xs text-red-500">Elimina</button>
                </div>
              </div>
              {materials.filter(m => m.category_id === cat.id && (m as any).subcategory_id === s.id && match(m) && (!subId || subId === s.id)).map(m => (
                <div key={m.id} className="border-b py-2 text-sm flex justify-between gap-3">
                  <div className="flex gap-3">
                    {m.image_url ? <img src={m.image_url} alt="" className="h-10 w-10 object-contain" /> : null}
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-slate-500">{m.unit} · EUR {Number(m.unit_price).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Link to={'/materiale/' + m.id} className="text-blue-600">Modifica</Link>
                    <button type="button" onClick={() => deleteMaterial(m.id)} className="text-red-600">Elimina</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {materials.filter(m => m.category_id === cat.id && !(m as any).subcategory_id && match(m) && !subId).map(m => (
            <div key={m.id} className="border-b py-2 text-sm flex justify-between gap-3">
              <div className="flex gap-3">
                {m.image_url ? <img src={m.image_url} alt="" className="h-10 w-10 object-contain" /> : null}
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-slate-500">{m.unit} · EUR {Number(m.unit_price).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link to={'/materiale/' + m.id} className="text-blue-600">Modifica</Link>
                <button type="button" onClick={() => deleteMaterial(m.id)} className="text-red-600">Elimina</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
