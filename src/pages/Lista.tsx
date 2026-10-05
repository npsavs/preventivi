import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

const STATI = [
  { value: 'non_spedito', label: 'Non spedito' },
  { value: 'in_attesa', label: 'In attesa' },
  { value: 'accettato', label: 'Accettato' },
  { value: 'rifiutato', label: 'Rifiutato' },
]

function statoLabel(v: string) {
  return STATI.find(s => s.value === v)?.label || 'Non spedito'
}

function statoClass(v: string) {
  if (v === 'accettato') return 'bg-green-100 text-green-800'
  if (v === 'rifiutato') return 'bg-red-100 text-red-800'
  if (v === 'in_attesa') return 'bg-yellow-100 text-yellow-800'
  return 'bg-slate-100 text-slate-700'
}

function annoDi(r: any) {
  return String(r.created_at || '').slice(0, 4)
}

export default function Lista() {
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState<any[]>([])
  const [itemsAll, setItemsAll] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('tutti')
  const [filtroAnno, setFiltroAnno] = useState(String(new Date().getFullYear()))

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false })
    const { data: it } = await supabase.from('quote_items').select('quote_id, quantity, unit_price')
    setQuotes(data || [])
    setItemsAll(it || [])
    setLoading(false)
  }

  async function setStatus(id: string, status: string) {
    await supabase.from('quotes').update({ status }).eq('id', id)
    load()
  }

  async function elimina(id: string) {
    if (!confirm('Eliminare questo preventivo?')) return
    await supabase.from('quote_items').delete().eq('quote_id', id)
    await supabase.from('quotes').delete().eq('id', id)
    load()
  }

  async function creaFattura(row: any) {
    if (!row.client_id) return alert('Manca il cliente in anagrafica')
    if (!confirm('Creare una fattura dalle righe di ' + row.quote_number + '?')) return
    const year = new Date().getFullYear()
    const { data: esistenti } = await supabase.from('invoices').select('invoice_number, invoice_type')
    const usati = (esistenti || []).filter(x => (x.invoice_type || 'fattura') === 'fattura').map(x => {
      const m = String(x.invoice_number || '').match(/^(\d+)\/(\d{4})$/)
      if (m && Number(m[2]) === year) return Number(m[1])
      return 0
    })
    const numero = (Math.max(0, ...usati) + 1) + '/' + year
    const inv = await supabase.from('invoices').insert({
      invoice_number: numero,
      client_id: row.client_id,
      invoice_type: 'fattura',
      sdi_status: 'bozza',
      oggetto: row.oggetto || ('Da preventivo ' + row.quote_number),
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
    }).select().single()
    if (inv.error || !inv.data) return alert(inv.error?.message || 'Fattura non creata')
    const righe = itemsAll.filter(i => i.quote_id === row.id)
    if (righe.length) {
      const { data: dettagli } = await supabase.from('quote_items').select('*').eq('quote_id', row.id)
      await supabase.from('invoice_items').insert((dettagli || []).map(i => ({
        invoice_id: inv.data.id,
        name: i.name,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        vat_rate: 22,
      })))
    }
    window.open('https://fatture-self.vercel.app/fattura/' + inv.data.id, '_blank')
  }

  const cerca = q.trim().toLowerCase()
  const filtered = quotes.filter(row => {
    if (cerca && !(String(row.quote_number || '').toLowerCase().includes(cerca) || String(row.clients?.name || '').toLowerCase().includes(cerca))) return false
    if (filtroAnno && annoDi(row) !== filtroAnno) return false
    if (filtro !== 'tutti' && (row.status || 'non_spedito') !== filtro) return false
    return true
  })

  const stats = useMemo(() => {
    function conto(lista: any[]) {
      const ids = new Set(lista.map(r => r.id))
      const imponibile = itemsAll.filter(i => ids.has(i.quote_id)).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)
      return { imponibile, iva: imponibile * 0.22, totale: imponibile * 1.22, n: lista.length }
    }
    const anno = String(new Date().getFullYear())
    const base = quotes.filter(r => !cerca || String(r.quote_number || '').toLowerCase().includes(cerca) || String(r.clients?.name || '').toLowerCase().includes(cerca))
    return {
      corrente: conto(base.filter(r => annoDi(r) === anno)),
      scelto: conto(filtroAnno ? base.filter(r => annoDi(r) === filtroAnno) : base),
    }
  }, [quotes, itemsAll, filtroAnno, cerca])

  if (loading) return <div className="text-center py-10">Caricamento...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Preventivi</h1>
        <Link to="/nuovo" className="bg-slate-900 text-white px-4 py-2 rounded-lg">+ Nuovo preventivo</Link>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Preventivi {new Date().getFullYear()} · {cerca || 'tutti'} · {stats.corrente.n}</p>
          <p className="text-xl font-bold">EUR {stats.corrente.totale.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Imponibile {stats.corrente.imponibile.toFixed(2)} · IVA {stats.corrente.iva.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Preventivi {filtroAnno || 'tutti gli anni'} · {cerca || 'tutti'} · {stats.scelto.n}</p>
          <p className="text-xl font-bold">EUR {stats.scelto.totale.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Imponibile {stats.scelto.imponibile.toFixed(2)} · IVA {stats.scelto.iva.toFixed(2)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl shadow">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca cliente o numero..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)} className="border rounded-lg px-2 py-2 text-sm">
          <option value="">Tutti gli anni</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
        <button type="button" onClick={() => setFiltro('tutti')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'tutti' ? 'bg-slate-900 text-white' : 'border')}>Tutti</button>
        {STATI.map(s => (
          <button key={s.value} type="button" onClick={() => setFiltro(s.value)} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === s.value ? 'bg-slate-900 text-white' : 'border')}>{s.label}</button>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow divide-y">
        {filtered.length === 0 ? <p className="p-6 text-center text-slate-500">Nessun preventivo</p> : null}
        {filtered.map(row => (
          <div key={row.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            <Link to={'/preventivo/' + row.id} className="flex-1 min-w-[180px]">
              <p className="font-medium">{row.quote_number} · {row.clients?.name || 'Senza cliente'}</p>
              <p className="text-sm text-slate-500">{format(parseISO(row.created_at), 'dd MMM yyyy', { locale: it })}</p>
            </Link>
            <select value={row.status || 'non_spedito'} onChange={e => setStatus(row.id, e.target.value)} className={'text-sm border rounded-lg px-2 py-1 ' + statoClass(row.status || 'non_spedito')}>
              {STATI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="button" onClick={() => creaFattura(row)} className="text-sm bg-slate-900 text-white px-3 py-1 rounded-lg">Crea fattura</button>
            <button type="button" onClick={() => elimina(row.id)} className="text-sm text-red-600">Elimina</button>
          </div>
        ))}
      </div>
    </div>
  )
}