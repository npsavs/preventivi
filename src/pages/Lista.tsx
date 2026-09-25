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

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('quotes')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }

  async function setStatus(id: string, status: string) {
    await supabase.from('quotes').update({ status }).eq('id', id)
    load()
  }

  async function elimina(id: string) {
    if (!confirm('Eliminare questo preventivo?')) return
    await supabase.from('quotes').delete().eq('id', id)
    load()
  }

  async function duplica(q: any) {
    const num = String(Date.now()).slice(-5) + '/' + new Date().getFullYear()
    const { data: nuovo, error } = await supabase
      .from('quotes')
      .insert({
        quote_number: num,
        client_id: q.client_id,
        notes: q.notes,
        oggetto: q.oggetto,
        footer_notes: q.footer_notes,
        status: 'non_spedito',
      })
      .select()
      .single()
    if (error || !nuovo) {
      alert(error?.message || 'Errore')
      return
    }
    const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', q.id)
    if (items && items.length) {
      await supabase.from('quote_items').insert(
        items.map(i => ({
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
        }))
      )
    }
    navigate(`/preventivo/${nuovo.id}`)
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
          <div key={q.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            <Link to={`/preventivo/${q.id}`} className="flex-1 min-w-[180px]">
              <p className="font-medium">{q.quote_number} · {q.clients?.name || 'Senza cliente'}</p>
              <p className="text-sm text-slate-500">
                {format(parseISO(q.created_at), 'dd MMM yyyy', { locale: it })}
              </p>
            </Link>

            <select
              value={q.status || 'non_spedito'}
              onChange={e => setStatus(q.id, e.target.value)}
              className={`text-sm border rounded-lg px-2 py-1 ${statoClass(q.status || 'non_spedito')}`}
            >
              {STATI.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <span className={`text-xs px-2 py-1 rounded-full ${statoClass(q.status || 'non_spedito')}`}>
              {statoLabel(q.status || 'non_spedito')}
            </span>

            <button onClick={() => duplica(q)} className="text-sm text-blue-600">Duplica</button>
            <button onClick={() => elimina(q.id)} className="text-sm text-red-600">Elimina</button>
          </div>
        ))}
      </div>
    </div>
  )
}