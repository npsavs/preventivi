import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client, Category, Material, QuoteItem } from '../types'

const NOTE_DEFAULT = `NUOVO PUNTO SICUREZZA SNC E' CERTIFICATA AJAX SU LINEA BASIC SUPERIOR E FIBRA.
LA GARANZIA COPRE TUTTI I PRODOTTI PER 24 MESI E SARA' GESTITA DIRETTAMENTE DA NOI.`

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quoteId, setQuoteId] = useState<string | null>(id || null)
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [items, setItems] = useState<QuoteItem[]>([])
  const [clientId, setClientId] = useState('')
  const [search, setSearch] = useState('')
  const [oggetto, setOggetto] = useState('')
  const [footerNotes, setFooterNotes] = useState(NOTE_DEFAULT)
  const [quoteNumber, setQuoteNumber] = useState('')

  useEffect(() => {
    start()
  }, [])

  async function start() {
    const { data: cl } = await supabase.from('clients').select('*').order('name')
    const { data: cat } = await supabase.from('categories').select('*').order('name')
    const { data: mat } = await supabase.from('materials').select('*').order('name')
    setClients(cl || [])
    setCategories(cat || [])
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
    } else {
      const num = String(Date.now()).slice(-5) + '/' + new Date().getFullYear()
      const { data: q } = await supabase
        .from('quotes')
        .insert({
          quote_number: num,
          status: 'bozza',
          footer_notes: NOTE_DEFAULT,
        })
        .select()
        .single()
      if (q) {
        setQuoteId(q.id)
        setQuoteNumber(num)
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
    if (error) alert('Errore salvataggio: ' + error.message)
    else alert('Salvato')
  }

  async function addMaterial(m: Material, catName: string) {
    if (!quoteId) return
    const { data } = await supabase.from('quote_items').insert({
      quote_id: quoteId,
      material_id: m.id,
      category_name: catName,
      name: m.name,
      quantity: 1,
      unit: m.unit,
      unit_price: m.unit_price,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
  }

  async function updateQty(item: QuoteItem, quantity: number) {
    const qty = Math.max(1, Math.round(quantity))
    await supabase.from('quote_items').update({ quantity: qty }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: qty } : i))
  }

  async function removeItem(itemId: string) {
    await supabase.from('quote_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )
  const selectedClient = clients.find(c => c.id === clientId)
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

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Cliente da Anagrafica</h2>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca cliente..."
          className="w-full border rounded-lg px-3 py-2"
        />
        <div className="max-h-40 overflow-auto border rounded-lg">
          {filteredClients.map(c => (
            <button
              key={c.id}
              onClick={() => setClientId(c.id)}
              className={`block w-full text-left px-3 py-2 text-sm ${clientId === c.id ? 'bg-blue-50 font-medium' : 'hover:bg-slate-50'}`}
            >
              {c.name} {c.city ? `· ${c.city}` : ''}
            </button>
          ))}
        </div>
        {selectedClient && (
          <p className="text-sm text-slate-600">
            Selezionato: <strong>{selectedClient.name}</strong>
          </p>
        )}

        <label className="block text-sm font-medium">Oggetto</label>
        <textarea
          value={oggetto}
          onChange={e => setOggetto(e.target.value)}
          placeholder="Es. PREVENTIVO DI ALLARME AJAX LINEA SUPERIOR..."
          className="w-full border rounded-lg px-3 py-2"
          rows={2}
        />

        <label className="block text-sm font-medium">Note in fondo al preventivo</label>
        <textarea
          value={footerNotes}
          onChange={e => setFooterNotes(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          rows={6}
        />
        <p className="text-xs text-slate-500">
          La data di validità (30 giorni) viene aggiunta in automatico in stampa.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="font-semibold">Aggiungi materiali</h2>
          {categories.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl shadow p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">{cat.name}</h3>
              {materials.filter(m => m.category_id === cat.id).map(m => (
                <button
                  key={m.id}
                  onClick={() => addMaterial(m, cat.name)}
                  className="flex justify-between w-full text-sm py-1 hover:text-blue-600"
                >
                  <span>{m.name}</span>
                  <span>€ {Number(m.unit_price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-3">Righe preventivo</h2>
          {items.length === 0 && <p className="text-slate-400 text-sm">Nessun materiale</p>}
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 border-b py-2 text-sm">
              <div className="flex-1">
                <p>{item.name}</p>
                <p className="text-xs text-slate-400">{item.category_name}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => updateQty(item, Math.round(Number(item.quantity)) - 1)} className="w-7 h-7 border rounded bg-slate-100">−</button>
                <span className="w-8 text-center">{Math.round(Number(item.quantity))}</span>
                <button type="button" onClick={() => updateQty(item, Math.round(Number(item.quantity)) + 1)} className="w-7 h-7 border rounded bg-slate-100">+</button>
              </div>
              <span className="w-20 text-right">
                € {(Math.round(Number(item.quantity)) * Number(item.unit_price)).toFixed(2)}
              </span>
              <button onClick={() => removeItem(item.id)} className="text-red-600">x</button>
            </div>
          ))}
          <p className="text-right font-bold mt-4">Imponibile € {total.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}