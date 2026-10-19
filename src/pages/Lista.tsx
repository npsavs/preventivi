import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

const STATI = [
  { value: 'non_spedito', label: 'Non spedito' },
  { value: 'in_attesa', label: 'In attesa' },
  { value: 'accettato', label: 'Accettato' },
  { value: 'rifiutato', label: 'Rifiutato' },
]

function statoClass(v: string) {
  if (v === 'accettato') return 'bg-green-100 text-green-800'
  if (v === 'rifiutato') return 'bg-red-100 text-red-800'
  if (v === 'in_attesa') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function annoDi(r: any) {
  const d = r.created_at || ''
  return String(d).slice(0, 4)
}

function trimestreDi(r: any) {
  const d = new Date(r.created_at || '')
  if (isNaN(d.getTime())) return 1
  return Math.floor(d.getMonth() / 3) + 1
}

function normalizza(v: string) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function numeroIt(v: string) {
  const pulito = String(v || '').replace(/\./g, '').replace(',', '.')
  const n = Number(pulito)
  return Number.isFinite(n) ? n : 0
}

function dataPreventivo(testo: string) {
  const m = testo.match(/del\s+(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/i)
  if (!m) return null
  const giorno = m[1].padStart(2, '0')
  const mese = m[2].padStart(2, '0')
  return m[3] + '-' + mese + '-' + giorno
}

function imponibileDaTesto(testo: string) {
  const zone = testo.match(/imponibile[^0-9]{0,120}(\d{1,3}(?:\.\d{3})*,\d{2})/i)
  if (zone) return numeroIt(zone[1])
  const tutti = (testo.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || []).map(numeroIt).filter(n => n > 50)
  return tutti.length ? Math.max(...tutti) : 0
}

function nomeDestinatario(testo: string) {
  const m = testo.match(/DESTINATARIO\s+([A-Za-z][A-Za-z']+\s+[A-Za-z][A-Za-z']+)/)
  return m ? m[1].trim() : ''
}

function trovaCliente(testo: string, clients: any[], forzato: string) {
  if (forzato) {
    const c = clients.find(x => x.id === forzato)
    return { id: forzato, name: c?.name || '' }
  }
  const daPdf = nomeDestinatario(testo)
  if (!daPdf) return { id: null as string | null, name: '' }
  const esatto = clients.find(c => normalizza(c.name) === normalizza(daPdf))
  if (esatto) return { id: esatto.id, name: esatto.name }
  const contiene = clients.find(c => normalizza(c.name).includes(normalizza(daPdf)) || normalizza(daPdf).includes(normalizza(c.name)))
  if (contiene) return { id: contiene.id, name: contiene.name }
  return { id: null as string | null, name: daPdf }
}

async function caricaPdf() {
  const w = window as any
  if (w.pdfjsLib) return w.pdfjsLib
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs'
    s.type = 'module'
    s.onload = () => resolve(null)
    s.onerror = () => reject(new Error('PDF non caricato'))
    document.body.appendChild(s)
  })
  return w.pdfjsLib
}

async function testoPdf(file: File) {
  const pdfjs = await caricaPdf()
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs'
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  let testo = ''
  for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    testo += '\n' + content.items.map((it: any) => it.str || '').join(' ')
  }
  return testo
}

export default function Lista() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [itemsAll, setItemsAll] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('tutti')
  const [filtroAnno, setFiltroAnno] = useState(String(new Date().getFullYear()))
  const [trim, setTrim] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [clienteImport, setClienteImport] = useState('')
  const [cercaImport, setCercaImport] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false })
    const { data: it } = await supabase.from('quote_items').select('quote_id, quantity, unit_price, name, description')
    const { data: cl } = await supabase.from('clients').select('id, name').order('name')
    setQuotes(data || [])
    setItemsAll(it || [])
    setClients(cl || [])
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

  async function importaPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const esiti: string[] = []
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue
      let testo = ''
      try { testo = await testoPdf(file) } catch { testo = '' }
      const numero = numeroPreventivo(testo, file.name)
      const data = dataPreventivo(testo)
      const trovato = trovaCliente(testo, clients, clienteImport)
      const imponibile = imponibileDaTesto(testo)
      const path = 'preventivi/' + Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const up = await supabase.storage.from('prodotti').upload(path, file, { contentType: 'application/pdf', upsert: true })
      if (up.error) { esiti.push(file.name + ': PDF non caricato (' + up.error.message + ')'); continue }
      const url = supabase.storage.from('prodotti').getPublicUrl(path).data.publicUrl
      const ins = await supabase.from('quotes').insert({
        quote_number: numero,
        status: 'non_spedito',
        oggetto: trovato.name || 'Importato da PDF',
        notes: url,
        client_id: trovato.id,
        created_at: data ? data + 'T12:00:00' : undefined,
      }).select().single()
      if (ins.error || !ins.data) { esiti.push(file.name + ': errore salvataggio'); continue }
      if (imponibile > 0) {
        await supabase.from('quote_items').insert({
          quote_id: ins.data.id,
          name: 'Imponibile importato da PDF',
          description: 'Solo per le statistiche',
          quantity: 1,
          unit_price: imponibile,
        })
      }
      esiti.push(numero + ' → ' + (trovato.name || 'NESSUN CLIENTE') + ' · EUR ' + imponibile.toFixed(2))
    }
    e.target.value = ''
    alert(esiti.join('\n') || 'Nessun PDF')
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
    const { data: dettagli } = await supabase.from('quote_items').select('*').eq('quote_id', row.id)
    if (dettagli && dettagli.length) {
      await supabase.from('invoice_items').insert(dettagli.map(i => ({
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
  const annoCorrente = String(new Date().getFullYear())
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
    return {
      anno: conto(quotes.filter(r => annoDi(r) === annoCorrente)),
      trim: conto(quotes.filter(r => annoDi(r) === annoCorrente && trimestreDi(r) === trim)),
      filtro: conto(filtered),
      filtroTrim: conto(filtered.filter(r => trimestreDi(r) === trim)),
    }
  }, [quotes, itemsAll, filtered, trim])

  const nomeFiltro = STATI.find(s => s.value === filtro)?.label || 'Tutti'
  const clientiFiltrati = cercaImport.trim().length < 2 ? [] : clients.filter(c => c.name.toLowerCase().includes(cercaImport.toLowerCase())).slice(0, 8)
  const clienteScelto = clients.find(c => c.id === clienteImport)
  if (loading) return <div className="text-center py-10">Caricamento...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Preventivi</h1>
        <Link to="/nuovo" className="bg-slate-900 text-white px-4 py-2 rounded-lg">+ Nuovo preventivo</Link>
      </div>
      <div className="bg-white rounded-xl shadow p-3 space-y-2">
        <p className="text-sm font-medium">Importa PDF originali. Salva il file così com è e collega il cliente.</p>
        <input value={cercaImport} onChange={e => setCercaImport(e.target.value)} placeholder="Opzionale: forza un cliente per tutti..." className="w-full border rounded-lg px-3 py-2 text-sm" />
        {clientiFiltrati.map(c => (
          <button key={c.id} type="button" onClick={() => { setClienteImport(c.id); setCercaImport(c.name) }} className="block text-left text-sm px-2 py-1 hover:bg-blue-50 w-full">{c.name}</button>
        ))}
        {clienteScelto ? <p className="text-sm text-green-700">Cliente forzato: {clienteScelto.name}</p> : null}
        <label className="inline-block border px-4 py-2 rounded-lg bg-white cursor-pointer">
          Importa PDF
          <input type="file" accept="application/pdf" multiple onChange={importaPdf} className="hidden" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl shadow">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca cliente o numero..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)} className="border rounded-lg px-2 py-2 text-sm">
          <option value="">Tutti gli anni</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
        {[1, 2, 3, 4].map(t => (
          <button key={t} type="button" onClick={() => setTrim(t)} className={'px-3 py-2 rounded-lg text-sm ' + (trim === t ? 'bg-blue-700 text-white' : 'border')}>T{t}</button>
        ))}
        <button type="button" onClick={() => setFiltro('tutti')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'tutti' ? 'bg-slate-900 text-white' : 'border')}>Tutti</button>
        {STATI.map(s => (
          <button key={s.value} type="button" onClick={() => setFiltro(s.value)} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === s.value ? 'bg-slate-900 text-white' : 'border')}>{s.label}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Totale preventivi {annoCorrente}</p>
          <p className="text-xl font-bold">EUR {stats.anno.totale.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Imponibile {stats.anno.imponibile.toFixed(2)} · IVA {stats.anno.iva.toFixed(2)} · {stats.anno.n}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Trimestre T{trim} {annoCorrente}</p>
          <p className="text-xl font-bold">EUR {stats.trim.totale.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Imponibile {stats.trim.imponibile.toFixed(2)} · IVA {stats.trim.iva.toFixed(2)} · {stats.trim.n}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Filtro · {nomeFiltro} · {cerca || 'tutti'} · {filtroAnno || 'tutti gli anni'}</p>
          <p className="text-xl font-bold">EUR {stats.filtro.totale.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Imponibile {stats.filtro.imponibile.toFixed(2)} · IVA {stats.filtro.iva.toFixed(2)} · {stats.filtro.n}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Filtro T{trim} · {nomeFiltro} · {cerca || 'tutti'}</p>
          <p className="text-xl font-bold">EUR {stats.filtroTrim.totale.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Imponibile {stats.filtroTrim.imponibile.toFixed(2)} · IVA {stats.filtroTrim.iva.toFixed(2)} · {stats.filtroTrim.n}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow divide-y">
        {filtered.length === 0 ? <p className="p-6 text-center text-slate-500">Nessun preventivo</p> : null}
        {filtered.map(row => (
          <div key={row.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            <Link to={'/preventivo/' + row.id} className="flex-1 min-w-[180px]">
              <p className="font-medium">{row.quote_number} · {row.clients?.name || row.oggetto || 'Senza cliente'}</p>
              <p className="text-sm text-slate-500">{format(parseISO(row.created_at), 'dd MMM yyyy', { locale: it })}</p>
            </Link>
            {String(row.notes || '').startsWith('http') ? <a href={row.notes} target="_blank" rel="noreferrer" className="text-sm border px-3 py-1 rounded-lg">Apri PDF</a> : null}
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