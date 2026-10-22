import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client, Material, QuoteItem } from '../types'

const NOTE_DEFAULT = `NUOVO PUNTO SICUREZZA SNC E' CERTIFICATA AJAX SU LINEA BASIC SUPERIOR E FIBRA.
LA GARANZIA COPRE TUTTI I PRODOTTI PER 24 MESI E SARA' GESTITA DIRETTAMENTE DA NOI.`

async function prossimoNumero() {
  const year = new Date().getFullYear()
  const { data } = await supabase.from('quotes').select('quote_number')
  const usati = (data || []).map(q => {
    const m = String(q.quote_number || '').match(/^(\d+)\/(\d{4})$/)
    if (m && Number(m[2]) === year) return Number(m[1])
    return 0
  })
  return (Math.max(0, ...usati) + 1) + '/' + year
}

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const clienteFromUrl = new URLSearchParams(window.location.search).get('cliente')
  const eNuovo = !id

  const [quoteId, setQuoteId] = useState<string | null>(id || null)
  const [clients, setClients] = useState<Client[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [items, setItems] = useState<QuoteItem[]>([])
  const [clientId, setClientId] = useState(clienteFromUrl || '')
  const [searchClient, setSearchClient] = useState('')
  const [searchProd, setSearchProd] = useState('')
  const [oggetto, setOggetto] = useState('')
  const [footerNotes, setFooterNotes] = useState(NOTE_DEFAULT)
  const [quoteNumber, setQuoteNumber] = useState('')
  const [sconto, setSconto] = useState('')
  const [dirty, setDirty] = useState(false)
  const [modifica, setModifica] = useState(!id)
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', address: '', city: '' })

  useEffect(() => { start() }, [])

  useEffect(() => {
    function onLeave(e: BeforeUnloadEvent) {
      if (!modifica || !dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    async function onClick(e: MouseEvent) {
      if (!modifica || !dirty) return
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      if ((a.getAttribute('href') || '').indexOf('/stampa/') >= 0) return
      e.preventDefault()
      e.stopPropagation()
      const ok = await salvaOAbbandona()
      if (ok) window.location.href = a.href
    }
    window.addEventListener('beforeunload', onLeave)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty, modifica, clientId, quoteId, oggetto, footerNotes, quoteNumber, items])

  async function scriviRighe() {
    for (const item of items) {
      if (item.name === 'Nuova riga' && Number(item.unit_price) === 0) continue
      await supabase.from('quote_items').update({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }).eq('id', item.id)
    }
  }

  async function cancellaNuovo() {
    if (!quoteId || !eNuovo) return
    await supabase.from('quote_items').delete().eq('quote_id', quoteId)
    await supabase.from('quotes').delete().eq('id', quoteId)
  }

  async function salvaOAbbandona() {
    const salva = confirm('Salvare le modifiche?\nOK = salva\nAnnulla = abbandona' + (eNuovo ? ' e cancella il preventivo' : ' e lascia il preventivo com era'))
    if (!salva) {
      if (eNuovo) await cancellaNuovo()
      setDirty(false)
      setModifica(false)
      return true
    }
    if (!clientId) {
      alert('Senza cliente non salvo.' + (eNuovo ? ' Il preventivo viene cancellato.' : ' Il preventivo resta com era.'))
      if (eNuovo) await cancellaNuovo()
      setDirty(false)
      setModifica(false)
      return true
    }
    await scriviRighe()
    const { error } = await supabase.from('quotes').update({
      client_id: clientId,
      notes: oggetto,
      oggetto,
      footer_notes: footerNotes,
      quote_number: quoteNumber,
    }).eq('id', quoteId)
    if (error) { alert(error.message); return false }
    setDirty(false)
    setModifica(false)
    return true
  }

  
async function caricaClienti() {
  const tutti: any[] = []
  let start = 0
  while (true) {
    const { data: cl } = await supabase.from('clients').select('*').order('name').range(start, start + 999)
    if (!cl || cl.length === 0) break
    tutti.push(...cl)
    if (cl.length < 1000) break
    start += 1000
  }
  return tutti
}

async function start() {
    const cl = await caricaClienti()
    const { data: mat } = await supabase.from('materials').select('*').order('name')
    setClients(cl)
    setMaterials(mat || [])
    if (id) {
      const { data: q } = await supabase.from('quotes').select('*').eq('id', id).single()
      if (q) {
        setQuoteId(q.id)
        setClientId(q.client_id || '')
        setOggetto(q.oggetto || q.notes || '')
        setFooterNotes(q.footer_notes || NOTE_DEFAULT)
        setQuoteNumber(q.quote_number || '')
      }
      const { data: it } = await supabase.from('quote_items').select('*').eq('quote_id', id)
      setItems(it || [])
      setDirty(false)
      setModifica(false)
    } else {
      const num = await prossimoNumero()
      const { data: q } = await supabase.from('quotes').insert({
        quote_number: num,
        status: 'non_spedito',
        footer_notes: NOTE_DEFAULT,
        client_id: clienteFromUrl || null,
      }).select().single()
      if (q) {
        setQuoteId(q.id)
        setQuoteNumber(num)
        if (clienteFromUrl) setClientId(clienteFromUrl)
        setModifica(true)
        setDirty(true)
        navigate('/preventivo/' + q.id, { replace: true })
      }
    }
  }

  async function saveHeader() {
    if (!quoteId) return
    if (!clientId) return alert('Seleziona il cliente in anagrafica prima di salvare')
    if (!confirm('Confermi le modifiche al preventivo?')) return
    await scriviRighe()
    const { error } = await supabase.from('quotes').update({
      client_id: clientId,
      notes: oggetto,
      oggetto,
      footer_notes: footerNotes,
      quote_number: quoteNumber,
    }).eq('id', quoteId)
    if (error) alert('Errore: ' + error.message)
    else {
      setDirty(false)
      setModifica(false)
      alert('Salvato')
    }
  }

  async function addCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!modifica) return
    if (!newClient.name.trim()) return alert('Inserisci il nome')
    const { data, error } = await supabase.from('clients').insert({
      name: newClient.name.trim(),
      phone: newClient.phone || null,
      email: newClient.email || null,
      address: newClient.address || null,
      city: newClient.city || null,
      kind: 'cliente',
    }).select().single()
    if (error) return alert(error.message)
    setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setClientId(data.id)
    setDirty(true)
    setNewClient({ name: '', phone: '', email: '', address: '', city: '' })
    alert('Cliente salvato in Anagrafica')
  }

  async function addMaterial(m: Material) {
    if (!quoteId || !modifica) return
    const { data, error } = await supabase.from('quote_items').insert({
      quote_id: quoteId,
      material_id: m.id,
      name: m.name,
      description: m.description,
      image_url: m.image_url,
      quantity: 1,
      unit: m.unit,
      unit_price: m.unit_price,
      is_discount: false,
    }).select().single()
    if (error) return alert(error.message)
    if (data) setItems(prev => [...prev, data])
    setSearchProd('')
    setDirty(true)
  }

  async function addRigaLibera() {
    if (!quoteId || !modifica) return
    const { data, error } = await supabase.from('quote_items').insert({
      quote_id: quoteId,
      name: 'Nuova riga',
      description: '',
      quantity: 1,
      unit: 'pz',
      unit_price: 0,
      is_discount: false,
    }).select().single()
    if (error) return alert(error.message)
    if (data) setItems(prev => [...prev, data])
    setDirty(true)
  }

  async function addSconto(e: React.FormEvent) {
    e.preventDefault()
    if (!quoteId || !modifica || !sconto) return
    const val = Math.abs(Number(sconto))
    const { data } = await supabase.from('quote_items').insert({
      quote_id: quoteId,
      category_name: 'Sconto',
      name: 'SCONTO',
      quantity: 1,
      unit: 'pz',
      unit_price: -val,
      is_discount: true,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
    setSconto('')
    setDirty(true)
  }

  function updateItem(idItem: string, patch: Partial<QuoteItem>) {
    if (!modifica) return
    setDirty(true)
    setItems(prev => prev.map(i => i.id === idItem ? { ...i, ...patch } : i))
  }

  async function uploadFoto(itemId: string, file: File) {
    if (!modifica) return
    const ext = file.name.split('.').pop()
    const pathName = 'righe/' + Date.now() + '.' + ext
    const { error } = await supabase.storage.from('prodotti').upload(pathName, file)
    if (error) return alert('Foto non caricata: ' + error.message)
    const { data } = supabase.storage.from('prodotti').getPublicUrl(pathName)
    updateItem(itemId, { image_url: data.publicUrl })
  }

  function removeItem(itemId: string) {
    if (!modifica) return
    setDirty(true)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  const filteredClients = searchClient.trim().length < 2
    ? []
    : clients.filter(c => c.name.toLowerCase().includes(searchClient.toLowerCase()))
  const selectedClient = clients.find(c => c.id === clientId)
  const foundProducts = searchProd.trim().length >= 2
    ? materials.filter(m => m.name.toLowerCase().includes(searchProd.toLowerCase()) || (m.description || '').toLowerCase().includes(searchProd.toLowerCase())).slice(0, 8)
    : []
  const total = items.reduce((sum, i) => sum + Math.round(Number(i.quantity)) * Number(i.unit_price), 0)

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap gap-2 items-center">
        <h1 className="text-2xl font-bold flex-1">{quoteNumber || 'Nuovo preventivo'}</h1>
        {!modifica ? <button type="button" onClick={() => setModifica(true)} className="border px-4 py-2 rounded-lg bg-white">Modifica</button> : null}
        {quoteId ? <Link to={'/stampa/' + quoteId} className="bg-slate-900 text-white px-4 py-2 rounded-lg">Anteprima / Stampa</Link> : null}
      </div>
      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <h2 className="font-semibold">Cliente</h2>
        {selectedClient ? <p className="text-sm text-green-700">Cliente: <strong>{selectedClient.name}</strong></p> : <p className="text-sm text-red-700">Nessun cliente. Senza anagrafica non si puo salvare.</p>}
        {modifica ? (
          <>
            <input value={searchClient} onChange={e => setSearchClient(e.target.value)} placeholder="Scrivi almeno 2 lettere..." className="w-full border rounded-lg px-3 py-2" />
            {searchClient.trim().length >= 2 ? (
              <div className="max-h-32 overflow-auto border rounded-lg">
                {filteredClients.map(c => (
                  <button key={c.id} type="button" onClick={() => { setClientId(c.id); setDirty(true) }} className={'block w-full text-left px-3 py-2 text-sm ' + (clientId === c.id ? 'bg-blue-50 font-medium' : '')}>{c.name} {c.city ? '· ' + c.city : ''}</button>
                ))}
              </div>
            ) : null}
            <form onSubmit={addCliente} className="grid md:grid-cols-5 gap-2">
              <input value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} placeholder="Nome *" className="border rounded-lg px-2 py-2" />
              <input value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} placeholder="Telefono" className="border rounded-lg px-2 py-2" />
              <input value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="border rounded-lg px-2 py-2" />
              <input value={newClient.city} onChange={e => setNewClient(p => ({ ...p, city: e.target.value }))} placeholder="Citta" className="border rounded-lg px-2 py-2" />
              <button className="bg-blue-600 text-white rounded-lg">Salva cliente</button>
            </form>
          </>
        ) : null}
        <label className="block text-sm font-medium">Oggetto</label>
        <textarea value={oggetto} disabled={!modifica} onChange={e => { setOggetto(e.target.value); setDirty(true) }} className="w-full border rounded-lg px-3 py-2" rows={2} />
        <label className="block text-sm font-medium">Note in fondo</label>
        <textarea value={footerNotes} disabled={!modifica} onChange={e => { setFooterNotes(e.target.value); setDirty(true) }} className="w-full border rounded-lg px-3 py-2" rows={4} />
      </div>
      {modifica && quoteId ? (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="font-semibold">Aggiungi prodotti</h2>
          <input value={searchProd} onChange={e => setSearchProd(e.target.value)} placeholder="Cerca prodotto (almeno 2 lettere)..." className="w-full border rounded-lg px-3 py-2" />
          {foundProducts.length > 0 ? (
            <div className="border rounded-lg divide-y">
              {foundProducts.map(m => (
                <button key={m.id} type="button" onClick={() => addMaterial(m)} className="flex justify-between w-full px-3 py-2 text-sm text-left">
                  <span>{m.name}</span><span>EUR {Number(m.unit_price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={async () => {
            if (!clientId) return alert('Seleziona prima il cliente')
            await saveHeader()
            navigate('/preventivo/' + quoteId + '/materiali')
          }} className="bg-slate-900 text-white px-4 py-2 rounded-lg">Aggiungi prodotti</button>
          <button type="button" onClick={addRigaLibera} className="text-sm border px-3 py-1 rounded-lg ml-2">+ Riga libera</button>
          <form onSubmit={addSconto} className="flex gap-2 mt-2">
            <input value={sconto} onChange={e => setSconto(e.target.value)} placeholder="Sconto EUR" className="border rounded-lg px-2 py-1" />
            <button className="border px-3 py-1 rounded-lg">Aggiungi sconto</button>
          </form>
        </div>
      ) : null}
      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <h2 className="font-semibold">Righe del preventivo</h2>
        {items.map((item, idx) => {
          const m = String(item.description || '').match(/\|PREZZO_ORIGINALE:([\d.]+)\|SCONTO:(\d+)/)
          const prezzoOriginale = m ? Number(m[1]) : Number(item.unit_price)
          const sconto = m ? Number(m[2]) : 0
          const descPulita = String(item.description || '').replace(/ \|PREZZO_ORIGINALE:[\d.]+\|SCONTO:\d+/, '')
          function cambiaSconto(nuovo: number) {
            const s = Math.max(0, Math.min(100, nuovo))
            const prezzo = prezzoOriginale * (1 - s / 100)
            const desc = descPulita + (s > 0 ? ' |PREZZO_ORIGINALE:' + prezzoOriginale + '|SCONTO:' + s : '')
            updateItem(item.id, { unit_price: prezzo, description: desc })
          }
          function cambiaOriginale(nuovo: number) {
            const prezzo = nuovo * (1 - sconto / 100)
            const desc = descPulita + (sconto > 0 ? ' |PREZZO_ORIGINALE:' + nuovo + '|SCONTO:' + sconto : '')
            updateItem(item.id, { unit_price: prezzo, description: desc })
          }
          return (
            <div key={item.id} className="border rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Riga {idx + 1}</span>
                {modifica ? <button type="button" onClick={() => removeItem(item.id)} className="text-red-600">Elimina riga</button> : null}
              </div>
              <input value={item.name} disabled={!modifica} onChange={e => updateItem(item.id, { name: e.target.value })} className="w-full border rounded-lg px-3 py-2 font-medium" />
              <textarea value={descPulita} disabled={!modifica} onChange={e => updateItem(item.id, { description: e.target.value + (sconto > 0 ? ' |PREZZO_ORIGINALE:' + prezzoOriginale + '|SCONTO:' + sconto : '') })} className="w-full border rounded-lg px-3 py-2" rows={2} />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {!item.is_discount ? (
                  <>
                    <button type="button" disabled={!modifica} onClick={() => updateItem(item.id, { quantity: Math.max(1, Math.round(Number(item.quantity)) - 1) })} className="w-8 h-8 border rounded">-</button>
                    <span className="w-8 text-center">{Math.round(Number(item.quantity))}</span>
                    <button type="button" disabled={!modifica} onClick={() => updateItem(item.id, { quantity: Math.round(Number(item.quantity)) + 1 })} className="w-8 h-8 border rounded">+</button>
                  </>
                ) : null}
                <span className="text-slate-500">Prezzo originale</span>
                <input type="number" step="0.01" disabled={!modifica} value={prezzoOriginale} onChange={e => cambiaOriginale(Number(e.target.value))} className="w-24 border rounded-lg px-2 py-1" />
                <span className="text-slate-500">Sconto %</span>
                <input type="number" min="0" max="100" disabled={!modifica} value={sconto} onChange={e => cambiaSconto(Number(e.target.value))} className="w-16 border rounded-lg px-2 py-1" />
                {sconto > 0 ? <span className="text-red-600">EUR {Number(item.unit_price).toFixed(2)}</span> : null}
                <span className="ml-auto font-medium">EUR {(Math.round(Number(item.quantity)) * Number(item.unit_price)).toFixed(2)}</span>
              </div>
            </div>
          )
        })}
        <p className="text-right text-xl font-bold">Imponibile EUR {total.toFixed(2)}</p>
      </div>
      {modifica ? <button type="button" onClick={saveHeader} className="border px-4 py-2 rounded-lg bg-white">Salva</button> : null}
    </div>
  )
}