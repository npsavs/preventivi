import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category, Material } from '../types'

export default function Catalogo() {
  const [categories, setCategories] = useState<Category[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [newCat, setNewCat] = useState('')
  const [q, setQ] = useState('')
  const [catId, setCatId] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: c } = await supabase.from('categories').select('*').order('name')
    const { data: m } = await supabase.from('materials').select('*').order('name')
    setCategories(c || [])
    setMaterials((m || []) as Material[])
  }

  async function addCategory(e: any) {
    e.preventDefault()
    if (!newCat.trim()) return
    const { error } = await supabase.from('categories').insert({ name: newCat.trim() })
    if (error) return alert(error.message)
    setNewCat('')
    load()
  }

  async function renameCategory(id: string, name: string) {
    const { error } = await supabase.from('categories').update({ name }).eq('id', id)
    if (error) alert(error.message)
    else {
      setMsg('Categoria aggiornata')
      load()
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Eliminare la categoria e i prodotti dentro?')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) alert(error.message)
    else load()
  }

  async function deleteMaterial(id: string) {
    if (!confirm('Eliminare questo prodotto?')) return
    await supabase.from('materials').delete().eq('id', id)
    load()
  }

  const cats = catId ? categories.filter(c => c.id === catId) : categories
  const match = (m: Material) => {
    const t = q.toLowerCase()
    if (!t) return true
    return m.name.toLowerCase().includes(t) || String(m.description || '').toLowerCase().includes(t)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-2xl font-bold">Catalogo materiali</h1>
        <Link to="/materiale/nuovo" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">+ Nuovo prodotto</Link>
      </div>
      {msg ? <p className="text-green-700 text-sm">{msg}</p> : null}

      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl shadow">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca prodotto..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <button type="button" onClick={() => setCatId('')} className={'px-3 py-2 rounded-lg text-sm ' + (!catId ? 'bg-slate-900 text-white' : 'border')}>Tutte le categorie</button>
        {categories.map(c => (
          <button key={c.id} type="button" onClick={() => setCatId(c.id)} className={'px-3 py-2 rounded-lg text-sm ' + (catId === c.id ? 'bg-slate-900 text-white' : 'border')}>{c.name}</button>
        ))}
      </div>

      <form onSubmit={addCategory} className="bg-white p-4 rounded-xl shadow flex gap-3">
        <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nuova categoria" className="flex-1 border rounded-lg px-3 py-2" />
        <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg">Aggiungi categoria</button>
      </form>

      {cats.map(cat => (
        <div key={cat.id} className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex gap-2">
            <input defaultValue={cat.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== cat.name) renameCategory(cat.id, e.target.value.trim()) }} className="font-semibold border rounded px-2 py-1 flex-1" />
            <button type="button" onClick={() => deleteCategory(cat.id)} className="text-sm text-red-600">Elimina categoria</button>
          </div>
          {materials.filter(m => m.category_id === cat.id && match(m)).map(m => (
            <div key={m.id} className="border-b pb-3 text-sm flex justify-between gap-3">
              <div className="flex gap-3">
                {m.image_url ? <img src={m.image_url} alt="" className="h-12 w-12 object-contain" /> : null}
                <div>
                  <p className="font-medium">{m.name}</p>
                  {m.description ? <p className="text-slate-500">{m.description}</p> : null}
                  <p>{m.unit} · EUR {Number(m.unit_price).toFixed(2)}</p>
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