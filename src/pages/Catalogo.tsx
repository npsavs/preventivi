import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Category, Material } from '../types'

export default function Catalogo() {
  const [categories, setCategories] = useState<Category[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [newCat, setNewCat] = useState('')
  const [editCat, setEditCat] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    category_id: '',
    name: '',
    description: '',
    unit: 'pz',
    unit_price: '',
    image_url: '',
  })
  const [editMat, setEditMat] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: c } = await supabase.from('categories').select('*').order('name')
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

  async function saveCategory(id: string) {
    const name = editCat[id]
    if (!name?.trim()) return
    await supabase.from('categories').update({ name: name.trim() }).eq('id', id)
    load()
  }

  async function deleteCategory(id: string) {
    if (!confirm('Eliminare la categoria e i suoi prodotti?')) return
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  async function uploadImage(file: File) {
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('prodotti').upload(path, file)
    if (error) {
      alert('Errore foto: ' + error.message)
      return ''
    }
    const { data } = supabase.storage.from('prodotti').getPublicUrl(path)
    return data.publicUrl
  }

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.category_id) return
    await supabase.from('materials').insert({
      category_id: form.category_id,
      name: form.name,
      description: form.description || null,
      unit: form.unit || 'pz',
      unit_price: Number(form.unit_price || 0),
      image_url: form.image_url || null,
    })
    setForm(f => ({ ...f, name: '', description: '', unit_price: '', image_url: '' }))
    load()
  }

  async function saveMaterial(m: Material) {
    await supabase.from('materials').update({
      name: m.name,
      description: m.description,
      unit: m.unit,
      unit_price: Number(m.unit_price),
      image_url: m.image_url,
    }).eq('id', m.id)
    setEditMat(null)
    load()
  }

  async function deleteMaterial(id: string) {
    if (!confirm('Eliminare questo prodotto?')) return
    await supabase.from('materials').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Catalogo materiali</h1>

      <form onSubmit={addCategory} className="bg-white p-4 rounded-xl shadow flex gap-3">
        <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nuova categoria" className="flex-1 border rounded-lg px-3 py-2" />
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg">Aggiungi categoria</button>
      </form>

      <form onSubmit={addMaterial} className="bg-white p-4 rounded-xl shadow space-y-3">
        <div className="grid md:grid-cols-5 gap-3">
          <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="border rounded-lg px-3 py-2">
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Prodotto" className="border rounded-lg px-3 py-2" />
          <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="Unità" className="border rounded-lg px-3 py-2" />
          <input type="number" step="0.01" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="Prezzo €" className="border rounded-lg px-3 py-2" />
          <button className="bg-blue-600 text-white rounded-lg">Aggiungi prodotto</button>
        </div>
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrizione prodotto" className="w-full border rounded-lg px-3 py-2" />
        <input type="file" accept="image/*" onChange={async e => {
          const file = e.target.files?.[0]
          if (!file) return
          const url = await uploadImage(file)
          if (url) setForm(f => ({ ...f, image_url: url }))
        }} />
        {form.image_url && <img src={form.image_url} alt="" className="h-16 object-contain" />}
      </form>

      {categories.map(cat => (
        <div key={cat.id} className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <input
              value={editCat[cat.id] ?? cat.name}
              onChange={e => setEditCat(prev => ({ ...prev, [cat.id]: e.target.value }))}
              className="font-semibold border rounded px-2 py-1 flex-1"
            />
            <button onClick={() => saveCategory(cat.id)} className="text-sm text-blue-600">Salva nome</button>
            <button onClick={() => deleteCategory(cat.id)} className="text-sm text-red-600">Elimina categoria</button>
          </div>

          {materials.filter(m => m.category_id === cat.id).map(m => (
            <div key={m.id} className="border-b pb-3 text-sm">
              {editMat === m.id ? (
                <div className="space-y-2">
                  <input value={m.name} onChange={e => setMaterials(list => list.map(x => x.id === m.id ? { ...x, name: e.target.value } : x))} className="w-full border rounded px-2 py-1" />
                  <input value={m.description || ''} onChange={e => setMaterials(list => list.map(x => x.id === m.id ? { ...x, description: e.target.value } : x))} className="w-full border rounded px-2 py-1" placeholder="Descrizione" />
                  <div className="flex gap-2">
                    <input value={m.unit || ''} onChange={e => setMaterials(list => list.map(x => x.id === m.id ? { ...x, unit: e.target.value } : x))} className="border rounded px-2 py-1 w-20" />
                    <input type="number" value={m.unit_price} onChange={e => setMaterials(list => list.map(x => x.id === m.id ? { ...x, unit_price: Number(e.target.value) } : x))} className="border rounded px-2 py-1 w-28" />
                    <button onClick={() => saveMaterial(m)} className="text-blue-600">Salva</button>
                    <button onClick={() => setEditMat(null)}>Annulla</button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start gap-3">
                  <div className="flex gap-3">
                    {m.image_url && <img src={m.image_url} alt="" className="h-12 w-12 object-contain" />}
                    <div>
                      <p className="font-medium">{m.name}</p>
                      {m.description && <p className="text-slate-500">{m.description}</p>}
                      <p>{m.unit} · € {Number(m.unit_price).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditMat(m.id)} className="text-blue-600">Modifica</button>
                    <button onClick={() => deleteMaterial(m.id)} className="text-red-600">Elimina</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
}