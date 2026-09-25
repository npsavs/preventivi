import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Category, Material } from '../types'

export default function Catalogo() {
  const [categories, setCategories] = useState<Category[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [newCat, setNewCat] = useState('')
  const [form, setForm] = useState({ category_id: '', name: '', unit: 'pz', unit_price: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: c } = await supabase.from('categories').select('*').order('sort_order').order('name')
    const { data: m } = await supabase.from('materials').select('*').order('name')
    setCategories(c || [])
    setMaterials(m || [])
    if (!form.category_id && c && c[0]) setForm(f => ({ ...f, category_id: c[0].id }))
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCat.trim()) return
    await supabase.from('categories').insert({ name: newCat.trim() })
    setNewCat('')
    load()
  }

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.category_id) return
    await supabase.from('materials').insert({
      category_id: form.category_id,
      name: form.name,
      unit: form.unit || 'pz',
      unit_price: Number(form.unit_price || 0),
    })
    setForm(f => ({ ...f, name: '', unit_price: '' }))
    load()
  }

  async function deleteMaterial(id: string) {
    if (!confirm('Eliminare questo materiale?')) return
    await supabase.from('materials').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Catalogo materiali</h1>

      <form onSubmit={addCategory} className="bg-white p-4 rounded-xl shadow flex gap-3">
        <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nuova categoria (es. Ajax, Cavi, Manodopera)" className="flex-1 border rounded-lg px-3 py-2" />
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg">Aggiungi categoria</button>
      </form>

      <form onSubmit={addMaterial} className="bg-white p-4 rounded-xl shadow grid md:grid-cols-5 gap-3">
        <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="border rounded-lg px-3 py-2">
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Materiale" className="border rounded-lg px-3 py-2" />
        <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="Unità" className="border rounded-lg px-3 py-2" />
        <input type="number" step="0.01" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="Prezzo €" className="border rounded-lg px-3 py-2" />
        <button className="bg-blue-600 text-white rounded-lg">Aggiungi</button>
      </form>

      {categories.map(cat => (
        <div key={cat.id} className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-3">{cat.name}</h2>
          <div className="space-y-2">
            {materials.filter(m => m.category_id === cat.id).map(m => (
              <div key={m.id} className="flex justify-between text-sm border-b pb-2">
                <span>{m.name} ({m.unit})</span>
                <span>
                  € {Number(m.unit_price).toFixed(2)}
                  <button onClick={() => deleteMaterial(m.id)} className="ml-3 text-red-600">Elimina</button>
                </span>
              </div>
            ))}
            {materials.filter(m => m.category_id === cat.id).length === 0 && (
              <p className="text-slate-400 text-sm">Nessun materiale</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}