import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function numeroIt(v: string) {
  const pulito = String(v || '').replace(/\./g, '').replace(',', '.')
  const n = Number(pulito)
  return Number.isFinite(n) ? n : 0
}

function numeroPreventivo(testo: string, nomeFile: string) {
  const m = testo.match(/(\d{1,5}\/\d{4})/)
  return m ? m[1] : nomeFile.replace(/\.pdf$/i, '')
}

function dataPreventivo(testo: string) {
  const m = testo.match(/del\s+(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/i)
  if (!m) return null
  const giorno = m[1].padStart(2, '0')
  const mese = m[2].padStart(2, '0')
  return m[3] + '-' + mese + '-' + giorno
}

function imponibileDaTesto(testo: string) {
  const zone = testo.match(/Imponibile[^\d]*(\d{1,3}(?:\.\d{3})*,\d{2})/i)
  if (zone) return numeroIt(zone[1])
  const tutti = (testo.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || []).map(numeroIt).filter(n => n > 50)
  return tutti.length ? Math.max(...tutti) : 0
}

function normalizza(s: string) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
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

export default function ImportaPdf() {
  const [clients, setClients] = useState<any[]>([])
  const [clienteImport, setClienteImport] = useState('')
  const [cercaImport, setCercaImport] = useState('')
  const [esiti, setEsiti] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function carica() {
      const tutti: any[] = []
      let start = 0
      while (true) {
        const { data } = await supabase.from('clients').select('id, name').order('name').range(start, start + 999)
        if (!data || data.length === 0) break
        tutti.push(...data)
        if (data.length < 1000) break
        start += 1000
      }
      setClients(tutti)
    }
    carica()
  }, [])

  async function importaPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setBusy(true)
    const nuovi: string[] = []
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
      if (up.error) { nuovi.push(file.name + ': PDF non caricato'); continue }
      const url = supabase.storage.from('prodotti').getPublicUrl(path).data.publicUrl
      const ins = await supabase.from('quotes').insert({
        quote_number: numero,
        status: 'non_spedito',
        oggetto: (trovato.name || 'Importato da PDF') + (data ? ' · ' + data : ''),
        notes: url,
        client_id: trovato.id,
      }).select().single()
      if (ins.error || !ins.data) { nuovi.push(file.name + ': errore salvataggio'); continue }
      if (imponibile > 0) {
        await supabase.from('quote_items').insert({
          quote_id: ins.data.id,
          name: 'Imponibile importato da PDF',
          description: 'Solo per le statistiche',
          quantity: 1,
          unit_price: imponibile,
        })
      }
      nuovi.push(numero + ' → ' + (trovato.name || 'NESSUN CLIENTE') + ' · EUR ' + imponibile.toFixed(2))
    }
    e.target.value = ''
    setEsiti(nuovi)
    setBusy(false)
  }

  const clientiFiltrati = cercaImport.trim().length < 2 ? [] : clients.filter(c => c.name.toLowerCase().includes(cercaImport.toLowerCase())).slice(0, 12)
  const clienteScelto = clients.find(c => c.id === clienteImport)

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold">Importa PDF</h1>
      <p className="text-sm text-slate-500">Carica i PDF originali. Il sistema legge il numero, la data e il cliente.</p>
      <input value={cercaImport} onChange={e => setCercaImport(e.target.value)} placeholder="Opzionale: forza un cliente per tutti..." className="w-full border rounded-lg px-3 py-2" />
      {cercaImport.trim().length >= 2 && clientiFiltrati.length === 0 ? <p className="text-sm text-slate-500">Nessun cliente trovato</p> : null}
      {clientiFiltrati.map(c => (
        <button key={c.id} type="button" onClick={() => { setClienteImport(c.id); setCercaImport(c.name) }} className="block text-left text-sm px-2 py-1 hover:bg-blue-50 w-full border rounded">{c.name}</button>
      ))}
      {clienteScelto ? <p className="text-sm text-green-700">Cliente forzato: {clienteScelto.name}</p> : null}
      <label className="inline-block border px-4 py-2 rounded-lg bg-white cursor-pointer">
        {busy ? 'Importazione...' : 'Seleziona PDF'}
        <input type="file" accept="application/pdf" multiple onChange={importaPdf} className="hidden" disabled={busy} />
      </label>
      {esiti.length > 0 ? (
        <div className="bg-white rounded-xl shadow p-4 space-y-1">
          {esiti.map((e, i) => <p key={i} className="text-sm">{e}</p>)}
        </div>
      ) : null}
    </div>
  )
}
