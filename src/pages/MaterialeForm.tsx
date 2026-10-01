import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function MaterialeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<any[]>([])
  const [form, setForm] = useState({
    category_id: '',
    name: '',
    description: '',
    unit: 'pz',
    unit_price: '',
    image_url: '',
  })

  useEffect(() => { start() }, [id])

  async function start() {
    const { data: c } = await supabase.from('categories').select('*').order('name')
    setCategories(c || [])
    if (id) {
      const { data } = await supabase.from('materials').select('*').eq('id', id).single()
      if (data) {
        setForm({
          category_id: data.category_id || '',
          name: data.name || '',
          description: data.description || '',
          unit: data.unit || 'pz',
          unit_price: String(data.unit_price ?? ''),
          image_url: data.image_url || '',
        })
      }
    } else if (c && c[0]) {
      setForm(f => ({ ...f, category_id: f.category_id || c[0].id }))
    }
  }

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function uploadImage(file: File) {
    const ext = file.name.split('.').pop()
    const pathName = Date.now() + '.' + ext
    const { error } = await supabase.storage.from('prodotti').upload(pathName, file)
    if (error) {
      alert('Foto non caricata: ' + error.message)
      return
    }
    const { data } = supabase.storage.from('prodotti').getPublicUrl(pathName)
    set('image_url', data.publicUrl)
  }

  async function salva(e: any) {
    e.preventDefault()
    if (!form.name || !form.category_id) return alert('Metti nome e categoria')
    const payload = {
      category_id: form.category_id,
      name: form.name,
      description: form.description || null,
      unit: form.unit || 'pz',
      unit_price: Number(form.unit_price || 0),
      image_url: form.image_url || null,
    }
    const res = id
      ? await supabase.from('materials').update(payload).eq('id', id)
      : await supabase.from('materials').insert(payload)
    if (res.error) return alert(res.error.message)
    navigate('/catalogo')
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Link to="/catalogo" className="text-sm text-blue-600">Torna al catalogo</Link>
      <h1 className="text-2xl font-bold">{id ? 'Modifica prodotto' : 'Nuovo prodotto'}</h1>
      <form onSubmit={salva} className="bg-white rounded-xl shadow p-4 space-y-3">
        <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="w-full border rounded-lg px-3 py-2">
          <option value="">Scegli categoria</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome prodotto" className="w-full border rounded-lg px-3 py-2" />
        <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descrizione" className="w-full border rounded-lg px-3 py-2" />
        <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="Unita (pz)" className="w-full border rounded-lg px-3 py-2" />
        <input type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="Prezzo" className="w-full border rounded-lg px-3 py-2" />
        <input value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="URL foto" className="w-full border rounded-lg px-3 py-2" />
        <input type="file" accept="image/*" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) uploadImage(f) }} />
        {form.image_url ? <img src={form.image_url} alt="" className="h-20 object-contain" /> : null}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">Salva prodotto</button>
      </form>
    </div>
  )
}