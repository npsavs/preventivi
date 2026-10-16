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
  return String(r.created_at || '').slice(0, 4)
}

function trimestreDi(r: any) {
  const d = new Date(r.created_at)
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

function numeroPreventivo(testo: string, nomeFile: string) {
  const m = testo.match(/(\d{1,5}\/\d{4})/)
  return m ? m[1] : nomeFile.replace(/\.pdf$/i, '')
}

function imponibileDaTesto(testo: string) {
  const zone = testo.match(/imponibile[^0-9]{0,120}(\d{1,3}(?:\.\d{3})*,\d{2})/i)
  if (zone) return numeroIt(zone[1])
  const tutti = (testo.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || []).map(numeroIt).filter(n => n > 50)
  return tutti.length ? Math.max(...tutti) : 0
}

function nomeDestinatario(testo: string) {
  const m = testo.match(/DESTINATARIO\s+([A-Za-z][A-Za-z']+(?:\s+[A-Za-z][A-Za-z']+){0,3})/)
  return m ? m[1].trim() : ''
}

function trovaCliente(testo: string, clients: any[], forzato: string) {
  if (forzato) {
    const c = clients.find(x => x.id === forzato)
    return { id: forzato, name: c?.name || '' }
  }
  const daPdf = nomeDestinatario(testo)
  const t = normalizza(testo)
  const stop = new Set(['iva', 'spa', 'srl', 'snc', 'sas', 'gruppo', 'societa', 'ditta', 'azienda'])
  const candidati = clients.map(c => {
    const parti = String(c.name || '').split(/\s+/).filter(p => p.length >= 4 && !stop.has(normalizza(p)))
    const ok = parti.filter(p => t.includes(normalizza(p))).length
    const intero = normalizza(c.name)
    const pieno = intero.length >= 6 && t.includes(intero)
    const comePdf = daPdf && normalizza(c.name) === normalizza(daPdf)
    return { id: c.id, name: c.name, ok, pieno, comePdf, n: intero }
  }).filter(c => c.comePdf || c.pieno || c.ok >= 2)
  candidati.sort((a, b) => Number(b.comePdf) - Number(a.comePdf) || Number(b.pieno) - Number(a.pieno) || b.ok - a.ok || b.n.length - a.n.length)
  return candidati[0] || { id: null, name: daPdf || '' }
}

function righeDaTesto(testo: string) {
  const righe: { name: string; quantity: number; unit_price: number }[] = []
  const pezzi = testo.split(/(?=\d+\s+\d{1,3}(?:\.\d{3})*,\d{2}\s+€?\s*\d{1,3}(?:\.\d{3})*,\d{2})/)
  for (const pezzo of pezzi) {
    const m = pezzo.match(/(.{5,200}?)\s+(\d+)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+€?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/)
    if (!m) continue
    const name = m[1].replace(/\s+/g, ' ').trim().slice(-80)
    if (/descrizione|totale|imponibile|iva|cover|preventivo/i.test(name)) continue
    const q = Number(m[2])
    const p = numeroIt(m[3])
    if (q > 0 && p > 0) righe.push({ name, quantity: q, unit_price: p })
  }
  return righe
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
  for (let i = 1; i <= doc.numPages; i++) {
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
  const [debug, setDebug] = useState('')

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