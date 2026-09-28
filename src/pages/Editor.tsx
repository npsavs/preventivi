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
  return `${Math.max(0, ...usati) + 1}/${year}`
}

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const clienteFromUrl = new URLSearchParams(window.location.search).get('cliente')

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
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', address: '', city: '' })

  useEffect(() => { start() }, [])

  async function start() {
    const { data: cl } = await supabase.from('clients').select('*').order('name')
    const { data: mat } = await supabase.from('materials').select('*').order('name')
    setClients(cl || [])
    setMaterials(mat || [])

    if (id) {
      const { data: q } = await supabase.from('quotes').select('*').eq('id', id).single()
      if (q) {
        setQuoteId(q.id)
        setClientId(q.client_id || clienteFromUrl || '')
        setOggetto(q.oggetto || q.notes || '')
        setFooterNotes(q.footer_notes || NOTE_DEFAULT)
        setQuoteNumber(q.quote_number || '')
      }
      const { data: it } = await supabase.from('quote_items').select('*').eq('quote_id', id)
      setItems(it || [])
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
        navigate(`/preventivo/${q.id}`, { replace: true })
      }
    }
  }

  async function saveHeader() {
    if (!quoteId) return
    const { error } = await supabase.from('quotes').update({
      client_id: clientId || null,
      notes: oggetto,
      oggetto,
      footer_notes: footerNotes,
      quote_number: quoteNumber,
    }).eq('id', quoteId)
    if (error) alert('Errore: ' + error.message)
    else alert('Salvato')
  }

  async function addCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!newClient.name.trim()) return alert('Inserisci il nome')
    const { data, error } = await supabase.from('clients').insert({
      name: newClient.name.trim(),
      phone: newClient.phone || null,
      email: newClient.email || null,
      address: newClient.address || null,
      city: newClient.city || null,
    }).select().single()
    if (error) return alert(error.message)
    setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setClientId(data.id)
    setNewClient({ name: '', phone: '', email: '', address: '', city: '' })
    alert('Cliente salvato in Anagrafica')
  }

  async function addMaterial(m: Material) {
    if (!quoteId) return
    const { data, error } = await supabase.from('quote_items').insert({
      quote_id: quoteId,
      material_id: m.id,
      category_name: null,
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
  }

  async function addRigaLibera() {
    if (!quoteId) return
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
  }

  async function addSconto(e: React.FormEvent) {
    e.preventDefault()
    if (!quoteId || !sconto) return
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
  }

  async function updateItem(idItem: string, patch: Partial<QuoteItem>) {
    const { error } = await supabase.from('quote_items').update(patch).eq('id', idItem)
    if (error) return alert(error.message)
    setItems(prev => prev.map(i => i.id === idItem ? { ...i, ...patch } : i))
  }

  async function uploadFoto(itemId: string, file: File) {
    const ext = file.name.split('.').pop()
    const pathName = `righe/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('prodotti').upload(pathName, file)
    if (error) return alert('Foto non caricata: ' + error.message)
    const { data } = supabase.storage.from('prodotti').getPublicUrl(pathName)
    updateItem(itemId, { image_url: data.publicUrl })
  }

  async function removeItem(itemId: string) {
    await supabase.from('quote_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchClient.toLowerCase())
  )
  const selectedClient = clients.find(c => c.id === clientId)
  const foundProducts = searchProd.trim().length >= 2
    ? materials.filter(m =>
        m.name.toLowerCase().includes(searchProd.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(searchProd.toLowerCase())
      ).slice(0, 8)
    : []
  const total = items.reduce((sum, i) => sum + Math.round(Number(i.quantity)) * Number(i.unit_price), 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{quoteNumber || 'Nuovo preventivo'}</h1>
        <div className="flex gap-2">
          <button onClick={saveHeader} className="border px-4 py-2 rounded-lg">Salva</button>
          {quoteId && (
            <Link to={`/stampa/${quoteId}`} className="bg-slate-900 text-white px-4 py-2 rounded-lg">
              Anteprima / Stampa
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <h2 className="font-semibold">Cliente</h2>
        <input
          value={searchClient}
          onChange={e => setSearchClient(e.target.value)}
          placeholder="Cerca in anagrafica..."
          className="w-full border rounded-lg px-3 py-2"
        />
        <div className="max-h-32 overflow-auto border rounded-lg">
          {filteredClients.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClientId(c.id)}
              className={`block w-full text-left px-3 py-2 text-sm ${clientId === c.id ? 'bg-blue-50 font-medium' : 'hover:bg-slate-50'}`}
            >
              {c.name} {c.city ? `· ${c.city}` : ''}
            </button>
          ))}
        </div>
        {selectedClient && (
          <p className="text-sm text-green-700">Cliente selezionato: <strong>{selectedClient.name}</strong></p>
        )}

        <div className="border-t pt-3">
          <p className="font-medium mb-2">Il cliente non c’è? Crealo qui (si salva in Anagrafica)</p>
          <form onSubmit={addCliente} className="grid md:grid-cols-5 gap-2">
            <input value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} placeholder="Nome *" className="border rounded-lg px-2 py-2" />
            <input value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} placeholder="Telefono" className="border rounded-lg px-2 py-2" />
            <input value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="border rounded-lg px-2 py-2" />
            <input value={newClient.city} onChange={e => setNewClient(p => ({ ...p, city: e.target.value }))} placeholder="Città" className="border rounded-lg px-2 py-2" />
            <button className="bg-blue-600 text-white rounded-lg">Salva cliente</button>
          </form>
        </div>

        <label className="block text-sm font-medium">Oggetto</label>
        <textarea value={oggetto} onChange={e => setOggetto(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} />
        <label className="block text-sm font-medium">Note in fondo</label>
        <textarea value={footerNotes} onChange={e => setFooterNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={4} />
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Aggiungi una riga</h2>
        <input
          value={searchProd}
          onChange={e => setSearchProd(e.target.value)}
          placeholder="Cerca prodotto nel catalogo (almeno 2 lettere)..."
          className="w-full border rounded-lg px-3 py-2"
        />
        {foundProducts.length > 0 && (
          <div className="border rounded-lg divide-y">
            {foundProducts.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => addMaterial(m)}
                className="flex justify-between w-full px-3 py-2 text-sm hover:bg-blue-50 text-left"
              >
                <span>
                  {m.name}
                  {m.description ? <span className="block text-xs text-slate-500">{m.description}</span> : null}
                </span>
                <span>€ {Number(m.unit_price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addRigaLibera} className="border px-4 py-2 rounded-lg text-sm">
            + Riga libera
          </button>
          <form onSubmit={addSconto} className="flex gap-2">
            <input type="number" step="0.01" value={sconto} onChange={e => setSconto(e.target.value)} placeholder="Sconto €" className="border rounded-lg px-3 py-2 w-32" />
            <button className="bg-amber-500 text-white px-4 rounded-lg text-sm">Aggiungi sconto</button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <h2 className="font-semibold">Righe del preventivo</h2>
        {items.length === 0 && <p className="text-slate-400 text-sm">Nessuna riga. Cerca un prodotto oppure aggiungi una riga libera.</p>}
        {items.map((item, idx) => (
          <div key={item.id} className="border rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Riga {idx + 1}</span>
              <button type="button" onClick={() => removeItem(item.id)} className="text-red-600">Elimina riga</button>
            </div>
            <div className="flex gap-3 items-start">
              {item.image_url
                ? <img src={item.image_url} alt="" className="h-16 w-16 object-contain border rounded" />
                : <div className="h-16 w-16 border rounded bg-slate-50" />}
              <div className="flex-1 space-y-2">
                <input
                  value={item.name}
                  onChange={e => updateItem(item.id, { name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 font-medium"
                />
                <textarea
                  value={item.description || ''}
                  onChange={e => updateItem(item.id, { description: e.target.value })}
                  placeholder="Descrizione prodotto"
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) uploadFoto(item.id, file)
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!item.is_discount && (
                <>
                  <button type="button" onClick={() => updateItem(item.id, { quantity: Math.max(1, Math.round(Number(item.quantity)) - 1) })} className="w-8 h-8 border rounded">−</button>
                  <span className="w-8 text-center">{Math.round(Number(item.quantity))}</span>
                  <button type="button" onClick={() => updateItem(item.id, { quantity: Math.round(Number(item.quantity)) + 1 })} className="w-8 h-8 border rounded">+</button>
                </>
              )}
              <span className="text-sm">Prezzo €</span>
              <input
                type="number"
                step="0.01"
                value={item.unit_price}
                onChange={e => updateItem(item.id, { unit_price: Number(e.target.value) })}
                className="w-28 border rounded-lg px-2 py-1"
              />
              <span className="ml-auto font-medium">
                € {(Math.round(Number(item.quantity)) * Number(item.unit_price)).toFixed(2)}
              </span>
            </div>
          </div>
        ))}
        <p className="text-right text-xl font-bold">Imponibile € {total.toFixed(2)}</p>
      </div>
    </div>
  )
}