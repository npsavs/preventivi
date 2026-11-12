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
  const subFromUrl = new URLSearchParams(window.location.search).get('sub')
  const [catId, setCatId] = useState(catFromUrl || '')
  const [subId, setSubId] = useState(subFromUrl || '')
  const [aperto, setAperto] = useState('')
  const [msg, setMsg] = useState('')
  const [dragId, setDragId] = useState('')
  const [editVendita, setEditVendita] = useState('')
  const [tags, setTags] = useState<any[]>([])
  const [materialTags, setMaterialTags] = useState<any[]>([])
  const [tagId, setTagId] = useState('')

  async function spostaMateriale(daId: string, aId: string) {
    if (!daId || daId === aId) return
    const da = materials.find(m => m.id === daId)
    const a = materials.find(m => m.id === aId)
    if (!da || !a) return
    if (da.category_id !== a.category_id) return
    const subDa = (da as any).subcategory_id || null
    const subA = (a as any).subcategory_id || null
    if (subDa !== subA) return
    const gruppo = materials.filter(m => m.category_id === da.category_id && ((m as any).subcategory_id || null) === subDa)
    const idxDa = gruppo.findIndex(m => m.id === daId)
    const idxA = gruppo.findIndex(m => m.id === aId)
    if (idxDa < 0 || idxA < 0) return
    const nuovo = [...gruppo]
    const [spostato] = nuovo.splice(idxDa, 1)
    nuovo.splice(idxA, 0, spostato)
    for (let i = 0; i < nuovo.length; i++) {
      await supabase.from('materials').update({ sort_order: i }).eq('id', nuovo[i].id)
    }
    setDragId('')
    load()
  }

  useEffect(() => { load() }, [])

  async function load() {
    const { data: c } = await supabase.from('categories').select('*').order('name')
    const { data: s } = await supabase.from('subcategories').select('*').order('sort_order')
    const { data: m } = await supabase.from('materials').select('*').order('sort_order')
    const { data: tgs } = await supabase.from('tags').select('*').order('name')
    const { data: mt } = await supabase.from('material_tags').select('*')
    setCategories(c || [])
    setSubcategories(s || [])
    setMaterials((m || []) as Material[])
    setTags(tgs || [])
    setMaterialTags(mt || [])
  }


  async function addTag() {
    if (!catId) return alert('Seleziona prima una categoria: i tag appartengono a una sola categoria')
    const nome = prompt('Nome del tag')
    if (!nome || !nome.trim()) return
    const colori = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#f97316', '#06b6d4', '#64748b']
    const elenco = colori.map((c, i) => (i + 1) + ') ' + c).join('\n')
    const scelta = prompt('Colore del riquadro (1-8 o codice #hex):\n' + elenco, '1')
    let color = '#3b82f6'
    if (scelta) {
      const n = Number(scelta)
      if (n >= 1 && n <= 8) color = colori[n - 1]
      else if (scelta.startsWith('#')) color = scelta.trim()
    }
    const { error } = await supabase.from('tags').insert({ name: nome.trim(), color, category_id: catId })
    if (error) return alert(error.message)
    load()
  }

  async function deleteTag(id: string) {
    if (!confirm('Eliminare questo tag?')) return
    await supabase.from('material_tags').delete().eq('tag_id', id)
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) return alert(error.message)
    if (tagId === id) setTagId('')
    load()
  }

  async function toggleTagMateriale(materialId: string, tId: string) {
    const esiste = materialTags.some(x => x.material_id === materialId && x.tag_id === tId)
    if (esiste) {
      await supabase.from('material_tags').delete().eq('material_id', materialId).eq('tag_id', tId)
    } else {
      const { error } = await supabase.from('material_tags').insert({ material_id: materialId, tag_id: tId })
      if (error) return alert(error.message)
    }
    load()
  }

  function tagsDi(materialId: string) {
    const ids = materialTags.filter(x => x.material_id === materialId).map(x => x.tag_id)
    return tags.filter(tg => ids.includes(tg.id))
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

  async function setScontoSottocategoria(subId: string, sconto: number) {
    const sc = Math.max(0, Math.min(100, Number(sconto) || 0))
    const { error } = await supabase.from('subcategories').update({ sconto: sc }).eq('id', subId)
    if (error) return alert('Errore sconto: ' + error.message)
    const { data: dellaSub, error: e2 } = await supabase.from('materials').select('id, unit_price, prezzo_listino, prezzo_netto').eq('subcategory_id', subId)
    if (e2) return alert('Errore lettura prodotti: ' + e2.message)
    let n = 0
    for (const m of dellaSub || []) {
      const listino = Number((m as any).prezzo_listino || m.unit_price || 0)
      if (listino <= 0) continue
      // netto = listino * (1 - sconto/100)
      const netto = Number((listino * (1 - sc / 100)).toFixed(2))
      const { error: e3 } = await supabase.from('materials').update({ prezzo_listino: listino, prezzo_netto: netto }).eq('id', m.id)
      if (e3) { alert('Errore aggiornamento prodotto: ' + e3.message); continue }
      n++
    }
    setMsg('Sconto ' + sc + '%: netto aggiornato da listino su ' + n + ' prodotti.')
    await load()
  }

  async function salvaVendita(id: string, val: string) {
    const prezzo = Number(val || 0)
    const { error } = await supabase.from('materials').update({ unit_price: prezzo }).eq('id', id)
    if (error) return alert(error.message)
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, unit_price: prezzo } as any : m))
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

  async function renameSub(id: string) {
    const sub = subcategories.find(s => s.id === id)
    if (!sub) return
    const nome = prompt('Nuovo nome', sub.name)
    if (!nome || !nome.trim() || nome === sub.name) return
    const { error } = await supabase.from('subcategories').update({ name: nome.trim() }).eq('id', id)
    if (error) alert(error.message)
    else load()
  }

  async function deleteSubcategory(id: string) {
    if (!confirm('Eliminare la sottocategoria?')) return
    await supabase.from('subcategories').delete().eq('id', id)
    load()
  }

  async function evidenzia(id: string, attuale: boolean) {
    await supabase.from('materials').update({ evidenziato: !attuale }).eq('id', id)
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
    if (tagId) {
      const ok = materialTags.some(x => x.material_id === m.id && x.tag_id === tagId)
      if (!ok) return false
    }
    if (!q.trim()) return true
    const tq = q.toLowerCase()
    return m.name.toLowerCase().includes(tq) || (m.description || '').toLowerCase().includes(tq)
  }

  // Tag solo della categoria selezionata; con "Tutte" nessun tag in barra
  const tagsDellaCategoria = catId ? tags.filter(tg => tg.category_id === catId) : []
  const tagsVisibili = tagsDellaCategoria

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-2xl font-bold">Catalogo materiali</h1>
        <div className="flex gap-2">
          <Link to="/impostazioni" className="border px-4 py-2 rounded-lg text-sm">Impostazioni categorie / tag</Link>
          <Link to={'/materiale/nuovo' + (catId ? '?cat=' + catId : '') + (subId ? '&sub=' + subId : '')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">+ Nuovo prodotto</Link>
        </div>
      </div>
      {msg ? <p className="text-green-700 text-sm">{msg}</p> : null}

      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl shadow">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca prodotto..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <button type="button" onClick={() => { setCatId(''); setSubId(''); setTagId('') }} className={'px-3 py-2 rounded-lg text-sm ' + (!catId ? 'bg-slate-900 text-white' : 'border')}>Tutte</button>
        {categories.map(c => (
          <button key={c.id} type="button" onClick={() => { setCatId(c.id); setSubId(''); setTagId('') }} className={'px-3 py-2 rounded-lg text-sm ' + (catId === c.id ? 'bg-slate-900 text-white' : 'border')}>{c.name}</button>
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

      
      <div className="flex flex-wrap gap-2 items-center bg-white p-3 rounded-xl shadow">
        <span className="text-sm text-slate-500">Tag:</span>
        {!catId ? <span className="text-xs text-slate-400">Seleziona una categoria per vedere i tag</span> : null}
        {catId ? <button type="button" onClick={() => setTagId('')} className={'px-3 py-1.5 rounded-lg text-sm border ' + (!tagId ? 'bg-slate-900 text-white border-slate-900' : '')}>Tutti</button> : null}
        {tagsVisibili.map(tg => (
          <button key={tg.id} type="button" onClick={() => setTagId(tagId === tg.id ? '' : tg.id)}
            className={'px-3 py-1.5 rounded-lg text-sm text-white flex items-center gap-2 ' + (tagId === tg.id ? 'ring-2 ring-offset-1 ring-slate-900' : '')}
            style={{ backgroundColor: tg.color || '#64748b' }}>
            {tg.name}
            <span onClick={e => { e.stopPropagation(); deleteTag(tg.id) }} className="text-xs opacity-80 hover:opacity-100">×</span>
          </button>
        ))}
        {catId ? <Link to="/impostazioni" className="px-3 py-1.5 rounded-lg text-sm border border-dashed">Gestisci tag</Link> : null}
      </div>

      {cats.map(cat => (
        <div key={cat.id} className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input defaultValue={cat.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== cat.name) renameCategory(cat.id, e.target.value.trim()) }} className="font-semibold border rounded px-2 py-1 flex-1 min-w-[120px]" />
            <button type="button" onClick={() => deleteCategory(cat.id)} className="text-sm text-red-600">Elimina categoria</button>
          </div>
          {subcategories.filter(s => s.category_id === cat.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(s => (
            <div key={s.id} className="ml-4 border-l-2 pl-3">
              <div className="flex flex-wrap justify-between text-sm items-center gap-2">
                <span className="font-medium text-slate-600">{s.name}</span>
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="text-xs text-slate-500">Sconto %</label>
                  <input id={'sconto-' + s.id} type="number" min="0" step="0.1" defaultValue={Number(s.sconto || 0)} className="w-16 border rounded px-2 py-1 text-xs" />
                  <button type="button" onClick={() => {
                    const el = document.getElementById('sconto-' + s.id) as HTMLInputElement
                    setScontoSottocategoria(s.id, Number(el?.value || 0))
                  }} className="text-xs bg-slate-800 text-white px-2 py-1 rounded">Applica</button>
                  <button type="button" onClick={() => renameSub(s.id)} className="text-xs text-blue-600">Modifica</button>
                  <button type="button" onClick={() => spostaSub(s.id, -1)} className="text-xs text-slate-500">↑</button>
                  <button type="button" onClick={() => spostaSub(s.id, 1)} className="text-xs text-slate-500">↓</button>
                  <button type="button" onClick={() => deleteSubcategory(s.id)} className="text-xs text-red-500">Elimina</button>
                </div>
              </div>
              {materials.filter(m => m.category_id === cat.id && (m as any).subcategory_id === s.id && match(m) && (!subId || subId === s.id)).map(m => (
                <div key={m.id} draggable onDragStart={() => setDragId(m.id)} onDragOver={e => e.preventDefault()} onDrop={() => spostaMateriale(dragId, m.id)} className="border-b py-2 text-sm">
                  <div className="flex justify-between gap-3 cursor-pointer" onClick={() => setAperto(aperto === m.id ? '' : m.id)}>
                    <div className="flex gap-3">
                      {m.image_url ? <img src={m.image_url} alt="" className="h-10 w-10 object-contain" /> : null}
                      <div>
                        <p className="font-medium" style={(m as any).evidenziato ? { background: '#bbf7d0', padding: '0 4px', borderRadius: '4px' } : {}}>{m.name}</p>

                        <p className="text-slate-500">{m.unit} · listino EUR {Number((m as any).prezzo_listino || 0).toFixed(2)} · netto EUR {Number((m as any).prezzo_netto || 0).toFixed(2)}</p>

                        <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>


                          <span className="text-sm font-semibold text-black">Vendita EUR {Number(m.unit_price || 0).toFixed(2)}</span>


                          {editVendita === m.id ? (


                            <>


                              <input id={'vendita-' + m.id} type="number" step="0.01" defaultValue={Number(m.unit_price || 0)} className="w-24 border rounded px-2 py-0.5 text-sm" autoFocus />


                              <button type="button" onClick={() => {


                                const el = document.getElementById('vendita-' + m.id) as HTMLInputElement


                                salvaVendita(m.id, el?.value || '0')


                                setEditVendita('')


                              }} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Salva</button>


                              <button type="button" onClick={() => setEditVendita('')} className="text-xs border px-2 py-0.5 rounded">Annulla</button>


                            </>


                          ) : (


                            <button type="button" onClick={() => setEditVendita(m.id)} className="text-xs text-blue-600">Modifica</button>


                          )}


                        </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tagsDi(m.id).map(tg => (
                          <span key={tg.id} className="text-xs text-white px-2 py-0.5 rounded" style={{ backgroundColor: tg.color }}>{tg.name}</span>
                        ))}
                      </div>

                      </div>
                    </div>
                  </div>
                  {aperto === m.id ? (
                    <div className="mt-2 pl-12 space-y-1">
                      {m.description ? <p className="text-slate-600 text-sm">{m.description}</p> : null}
                      <p className="text-slate-500 text-sm">Unità: {m.unit} · Listino: EUR {Number((m as any).prezzo_listino || m.unit_price || 0).toFixed(2)} · Netto: EUR {Number((m as any).prezzo_netto || 0).toFixed(2)} · Vendita: EUR {Number(m.unit_price).toFixed(2)}</p>
                      <div className="flex flex-wrap gap-1 my-1 items-center" onClick={e => e.stopPropagation()}>
                        {tagsDi(m.id).map(tg => (
                          <button key={tg.id} type="button" onClick={() => toggleTagMateriale(m.id, tg.id)}
                            className="text-xs text-white px-2 py-0.5 rounded" style={{ backgroundColor: tg.color }} title="Clic per togliere">
                            {tg.name} ×
                          </button>
                        ))}
                        <select className="text-xs border rounded px-1 py-0.5" defaultValue=""
                          onChange={e => { if (e.target.value) { toggleTagMateriale(m.id, e.target.value); e.target.value = '' } }}>
                          <option value="">+ Tag</option>
                          {tags.filter(tg => tg.category_id === m.category_id && !materialTags.some(x => x.material_id === m.id && x.tag_id === tg.id)).map(tg => (
                            <option key={tg.id} value={tg.id}>{tg.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-3">
                        <Link to={'/materiale/' + m.id} className="text-blue-600">Modifica</Link>
                        <button type="button" onClick={() => evidenzia(m.id, !!(m as any).evidenziato)} className="text-xs text-green-600">{(m as any).evidenziato ? 'Togli' : 'Evidenzia'}</button>
                        <button type="button" onClick={() => deleteMaterial(m.id)} className="text-red-600">Elimina</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
          {materials.filter(m => m.category_id === cat.id && !(m as any).subcategory_id && match(m) && !subId).map(m => (
            <div key={m.id} draggable onDragStart={() => setDragId(m.id)} onDragOver={e => e.preventDefault()} onDrop={() => spostaMateriale(dragId, m.id)} className="border-b py-2 text-sm">
              <div className="flex justify-between gap-3 cursor-pointer" onClick={() => setAperto(aperto === m.id ? '' : m.id)}>
                <div className="flex gap-3">
                  {m.image_url ? <img src={m.image_url} alt="" className="h-10 w-10 object-contain" /> : null}
                  <div>
                    <p className="font-medium" style={(m as any).evidenziato ? { background: '#bbf7d0', padding: '0 4px', borderRadius: '4px' } : {}}>{m.name}</p>

                    <p className="text-slate-500">{m.unit} · listino EUR {Number((m as any).prezzo_listino || 0).toFixed(2)} · netto EUR {Number((m as any).prezzo_netto || 0).toFixed(2)}</p>

                    <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>


                      <span className="text-sm font-semibold text-black">Vendita EUR {Number(m.unit_price || 0).toFixed(2)}</span>


                      {editVendita === m.id ? (


                        <>


                          <input id={'vendita-' + m.id} type="number" step="0.01" defaultValue={Number(m.unit_price || 0)} className="w-24 border rounded px-2 py-0.5 text-sm" autoFocus />


                          <button type="button" onClick={() => {


                            const el = document.getElementById('vendita-' + m.id) as HTMLInputElement


                            salvaVendita(m.id, el?.value || '0')


                            setEditVendita('')


                          }} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Salva</button>


                          <button type="button" onClick={() => setEditVendita('')} className="text-xs border px-2 py-0.5 rounded">Annulla</button>


                        </>


                      ) : (


                        <button type="button" onClick={() => setEditVendita(m.id)} className="text-xs text-blue-600">Modifica</button>


                      )}


                    </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tagsDi(m.id).map(tg => (
                          <span key={tg.id} className="text-xs text-white px-2 py-0.5 rounded" style={{ backgroundColor: tg.color }}>{tg.name}</span>
                        ))}
                      </div>

                  </div>
                </div>
              </div>
              {aperto === m.id ? (
                <div className="mt-2 pl-12 space-y-1">
                  {m.description ? <p className="text-slate-600 text-sm">{m.description}</p> : null}
                  <p className="text-slate-500 text-sm">Unità: {m.unit} · Listino: EUR {Number((m as any).prezzo_listino || m.unit_price || 0).toFixed(2)} · Netto: EUR {Number((m as any).prezzo_netto || 0).toFixed(2)} · Vendita: EUR {Number(m.unit_price).toFixed(2)}</p>
                  <div className="flex flex-wrap gap-1 my-1 items-center" onClick={e => e.stopPropagation()}>
                    {tagsDi(m.id).map(tg => (
                      <button key={tg.id} type="button" onClick={() => toggleTagMateriale(m.id, tg.id)}
                        className="text-xs text-white px-2 py-0.5 rounded" style={{ backgroundColor: tg.color }} title="Clic per togliere">
                        {tg.name} ×
                      </button>
                    ))}
                    <select className="text-xs border rounded px-1 py-0.5" defaultValue=""
                      onChange={e => { if (e.target.value) { toggleTagMateriale(m.id, e.target.value); e.target.value = '' } }}>
                      <option value="">+ Tag</option>
                      {tags.filter(tg => tg.category_id === m.category_id && !materialTags.some(x => x.material_id === m.id && x.tag_id === tg.id)).map(tg => (
                        <option key={tg.id} value={tg.id}>{tg.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <Link to={'/materiale/' + m.id} className="text-blue-600">Modifica</Link>
                    <button type="button" onClick={() => evidenzia(m.id, !!(m as any).evidenziato)} className="text-xs text-green-600">{(m as any).evidenziato ? 'Togli' : 'Evidenzia'}</button>
                    <button type="button" onClick={() => deleteMaterial(m.id)} className="text-red-600">Elimina</button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
