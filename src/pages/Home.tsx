import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

const STATI: Record<string, string> = {
  non_spedito: 'Non spedito',
  in_attesa: 'In attesa',
  accettato: 'Accettato',
  rifiutato: 'Rifiutato',
}

function statoClass(v: string) {
  if (v === 'accettato') return 'bg-green-100 text-green-800'
  if (v === 'rifiutato') return 'bg-red-100 text-red-800'
  if (v === 'in_attesa') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function dataDi(r: any) {
  const m = String(r.oggetto || '').match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : String(r.created_at || '').slice(0, 10)
}

export default function Home() {
  const [rows, setRows] = useState<any[]>([])
  const [q, setQ] = useState('')
  const year = new Date().getFullYear()

  useEffect(() => {
    supabase.from('quotes').select('id, quote_number, status, created_at, oggetto, clients(name)').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []))
  }, [])

  const anno = rows.filter(r => dataDi(r).slice(0, 4) === String(year))
  const n = (s: string) => anno.filter(r => (r.status || 'non_spedito') === s).length
  const cerca = q.trim().toLowerCase()
  const visibili = anno.filter(r => {
    if (!cerca) return true
    const nome = (r.clients && r.clients.name) || String(r.oggetto || '').split(' · ')[0] || ''
    return String(r.quote_number || '').toLowerCase().includes(cerca) || nome.toLowerCase().includes(cerca)
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Panoramica preventivi {year}</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/lista" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Totale {year}</p>
          <p className="text-xl font-bold">{anno.length}</p>
        </Link>
        <Link to="/lista" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Non spediti</p>
          <p className="text-xl font-bold">{n('non_spedito')}</p>
        </Link>
        <Link to="/lista" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">In attesa</p>
          <p className="text-xl font-bold">{n('in_attesa')}</p>
        </Link>
        <Link to="/lista" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-green-700">Accettati</p>
          <p className="text-xl font-bold">{n('accettato')}</p>
        </Link>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca cliente o numero..." className="w-full border rounded-lg px-4 py-2" />
      <div className="bg-white rounded-xl shadow divide-y">
        <p className="p-3 font-semibold text-sm">Preventivi {year}</p>
        {visibili.length === 0 ? <p className="p-4 text-center text-slate-500">Nessun preventivo</p> : null}
        {visibili.map(r => {
          const nome = (r.clients && r.clients.name) || String(r.oggetto || '').split(' · ')[0] || 'Senza cliente'
          const stato = r.status || 'non_spedito'
          return (
            <Link key={r.id} to={'/preventivo/' + r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.quote_number} · {nome}</p>
                <p className="text-xs text-slate-500">{format(parseISO(dataDi(r)), 'dd MMM yyyy', { locale: it })}</p>
              </div>
              <span className={'text-xs px-2 py-1 rounded ' + statoClass(stato)}>{STATI[stato] || stato}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}