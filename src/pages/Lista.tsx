import { useEffect, useState } from 'react'
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

export default function Lista() {
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('tutti')
  const [filtroAnno, setFiltroAnno] = useState(String(new Date().getFullYear()))

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false })
    setQuotes(data || [])
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

  async function duplica(row: any) {
    const year = new Date().getFullYear()
    const { data: existing } = await supabase.from('quotes').select('quote_number')
    const usati = (existing || []).map(x => {
      const m = String(x.quote_number || '').match(/^(\d+)\/(\d{4})$/)
      if (m && Number(m[2]) === year) return Number(m[1])
      return 0
    })
    const num = (Math.max(0, ...usati) + 1) + '/' + year
    const { data: nuovo, error } = await supabase.from('quotes').insert({
      quote_number: num,
      client_id: row.client_id,
      notes: row.notes,
      oggetto: row.oggetto,
      footer_notes: row.footer_notes,
      status: 'non_spedito',
    }).select().single()
    if (error || !nuovo) return alert(error?.message || 'Errore')
    const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', row.id)
    if (items && items.length) {
      await supabase.from('quote_items').insert(items.map(i => ({
        quote_id: nuovo.id,
        material_id: i.material_id,
        category_name: i.category_name,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        unit_price: i.unit_price,
        description: i.description,
        image_url: i.image_url,
        is_discount: i.is_discount,
      })))
    }
    navigate('/preventivo/' + nuovo.id)
  }

  const filtered = quotes.filter(row => {
    const t = q.toLowerCase()
    if (t && !(String(row.quote_number || '').toLowerCase().includes(t) || String(row.clients?.name || '').toLowerCase().includes(t))) return false
    if (filtroAnno && String(row.created_at || '').slice(0, 4) !== filtroAnno) return false
    if (filtro !== 'tutti' && (row.status || 'non_spedito') !== filtro) return false
    return true
  })

  if (loading) return <div className="text-center py-10">Caricamento...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Preventivi</h1>
        <Link to="/nuovo" className="bg-slate-900 text-white px-4 py-2 rounded-lg">+ Nuovo preventivo</Link>
      </div>
      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl shadow">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca numero o cliente..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
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
            <span className={'text-xs px-2 py-1 rounded-full ' + statoClass(row.status || 'non_spedito')}>{statoLabel(row.status || 'non_spedito')}</span>
            <button type="button" onClick={() => duplica(row)} className="text-sm text-blue-600">Duplica</button>
            <button type="button" onClick={() => elimina(row.id)} className="text-sm text-red-600">Elimina</button>
          </div>
        ))}
      </div>
    </div>
  )
}