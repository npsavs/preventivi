import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export default function Lista() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('quotes')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }

  if (loading) return <div className="text-center py-10">Caricamento...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Preventivi</h1>
        <Link to="/nuovo" className="bg-slate-900 text-white px-4 py-2 rounded-lg">
          + Nuovo preventivo
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow divide-y">
        {quotes.length === 0 && <p className="p-6 text-center text-slate-500">Nessun preventivo</p>}
        {quotes.map(q => (
          <Link key={q.id} to={`/preventivo/${q.id}`} className="block px-4 py-3 hover:bg-slate-50">
            <div className="flex justify-between">
              <p className="font-medium">{q.quote_number || 'Bozza'} · {q.clients?.name || 'Senza cliente'}</p>
              <span className="text-xs text-slate-500">{q.status}</span>
            </div>
            <p className="text-sm text-slate-500">
              {format(parseISO(q.created_at), 'dd MMM yyyy', { locale: it })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}