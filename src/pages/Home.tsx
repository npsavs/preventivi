import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [rows, setRows] = useState<any[]>([])
  const year = new Date().getFullYear()

  useEffect(() => {
    supabase.from('quotes').select('id, quote_number, status, created_at, clients(name)').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []))
  }, [])

  const y = rows.filter(r => String(r.created_at).slice(0, 4) === String(year))
  const n = (s: string) => y.filter(r => (r.status || 'non_spedito') === s).length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Panoramica preventivi {year}</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/lista" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Totale anno</p>
          <p className="text-xl font-bold">{y.length}</p>
        </Link>
        <Link to="/lista" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">In attesa</p>
          <p className="text-xl font-bold">{n('in_attesa')}</p>
        </Link>
        <Link to="/lista" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-green-700">Accettati</p>
          <p className="text-xl font-bold">{n('accettato')}</p>
        </Link>
        <Link to="/lista" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-red-600">Rifiutati</p>
          <p className="text-xl font-bold">{n('rifiutato')}</p>
        </Link>
      </div>
      <div className="bg-white rounded-xl shadow divide-y">
        <p className="p-3 font-semibold text-sm">Ultimi</p>
        {rows.slice(0, 8).map(r => (
          <Link key={r.id} to={'/preventivo/' + r.id} className="block px-4 py-2 text-sm hover:bg-slate-50">
            {r.quote_number} · {(r.clients && r.clients.name) || ''}
          </Link>
        ))}
      </div>
    </div>
  )
}