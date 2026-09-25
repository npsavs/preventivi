import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, parseISO, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function Stampa() {
  const { id } = useParams()
  const [quote, setQuote] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: q } = await supabase.from('quotes').select('*').eq('id', id).single()
    setQuote(q)
    if (q?.client_id) {
      const { data: c } = await supabase.from('clients').select('*').eq('id', q.client_id).single()
      setClient(c)
    }
    const { data: it } = await supabase.from('quote_items').select('*').eq('quote_id', id)
    setItems(it || [])
  }

  async function creaPdf() {
    const el = document.getElementById('foglio-preventivo')
    if (!el) throw new Error('Foglio non trovato')

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      onclone: (doc) => {
        const style = doc.createElement('style')
        style.innerHTML = `
          #foglio-preventivo {
            background: #ffffff !important;
            color: #262626 !important;
          }
          #foglio-preventivo * {
            color: #262626 !important;
            background-color: transparent !important;
            border-color: #a3a3a3 !important;
            box-shadow: none !important;
          }
        `
        doc.head.appendChild(style)
      },
    })

    const img = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgH = (canvas.height * pageW) / canvas.width
    pdf.addImage(img, 'JPEG', 0, 0, pageW, Math.min(imgH, pageH))
    const nomeFile = `Preventivo_${(client?.name || 'cliente').replace(/\s+/g, '_')}.pdf`
    return { pdf, nomeFile, blob: pdf.output('blob') }
  }

  async function invia(tipo: 'email' | 'whatsapp') {
    if (!quote) return
    setSending(true)
    try {
      const { blob, nomeFile } = await creaPdf()
      const file = new File([blob], nomeFile, { type: 'application/pdf' })
      const oggetto = `Preventivo ${client?.name || 'cliente'}`
      const testo = `Buongiorno,\n\nin allegato il preventivo richiesto.\n\nCordiali saluti\nNuovo Punto Sicurezza`

      const canShare = typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })

      if (canShare) {
        await navigator.share({
          files: [file],
          title: oggetto,
          text: testo,
        })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = nomeFile
        a.click()
        URL.revokeObjectURL(url)

        if (tipo === 'email' && client?.email) {
          window.location.href = `mailto:${client.email}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(testo)}`
        } else if (tipo === 'whatsapp') {
          const phone = (client?.phone || '').replace(/\D/g, '').replace(/^39/, '')
          if (phone) {
            window.open(`https://wa.me/39${phone}?text=${encodeURIComponent(testo)}`, '_blank')
          } else {
            alert('Manca il telefono del cliente')
          }
        } else {
          alert('PDF scaricato. Allegalo alla mail.')
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') alert('Errore: ' + (e.message || e))
    }
    setSending(false)
  }

  if (!quote) return <div className="text-center py-10">Caricamento...</div>

  const imponibile = items.reduce((s, i) => s + Math.round(Number(i.quantity)) * Number(i.unit_price), 0)
  const dataPrev = parseISO(quote.created_at)
  const validita = addDays(dataPrev, 30)
  const address = client
    ? [client.address, client.zip, client.city, client.province].filter(Boolean).join(' ')
    : ''

  return (
    <div className="bg-neutral-200 min-h-screen print:bg-white">
      <div className="no-print flex flex-wrap gap-3 max-w-[210mm] mx-auto py-4 px-4">
        <Link to={`/preventivo/${id}`} className="bg-white border px-4 py-2 text-sm">← Modifica</Link>
        <button onClick={() => window.print()} className="bg-neutral-800 text-white px-4 py-2 text-sm">Stampa / PDF</button>
        <button disabled={sending} onClick={() => invia('email')} className="bg-sky-700 text-white px-4 py-2 text-sm disabled:opacity-50">
          {sending ? 'Preparazione...' : 'Invia email'}
        </button>
        <button disabled={sending} onClick={() => invia('whatsapp')} className="bg-green-600 text-white px-4 py-2 text-sm disabled:opacity-50">
          {sending ? 'Preparazione...' : 'WhatsApp'}
        </button>
      </div>

      <article id="foglio-preventivo" className="bg-white w-[210mm] min-h-[297mm] mx-auto px-12 py-10 text-[12px] text-neutral-800 print:w-auto">
        <header className="flex justify-between items-start">
          <img src="/logo.png" alt="NPS" className="h-[70px] w-[70px] object-contain" />
          <div className="text-right text-[11px] leading-5">
            <p className="font-semibold">Nuovo Punto Sicurezza snc</p>
            <p>Via Claudia 50</p>
            <p>00062 - Bracciano (RM) - Italy</p>
            <p>P.IVA 05678201004</p>
          </div>
        </header>

        <p className="text-right font-semibold mt-6 mb-4">
          PREVENTIVO Nr. {quote.quote_number} del {format(dataPrev, 'dd/MM/yyyy')}
        </p>

        <div className="border-t border-neutral-300" />

        <div className="text-right mt-8 mb-8 leading-5">
          <p className="text-[10px] tracking-[0.2em] text-neutral-500 mb-1">DESTINATARIO</p>
          <p className="font-semibold uppercase">{client?.name || 'CLIENTE'}</p>
          {address && <p>{address}</p>}
          {client?.phone && <p>{client.phone}</p>}
          {client?.email && <p>{client.email}</p>}
        </div>

        <p className="mb-6 leading-5">
          <span className="font-semibold">Oggetto: </span>
          {quote.oggetto || quote.notes || 'PREVENTIVO IMPIANTO DI ALLARME'}
        </p>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-neutral-400 text-[10px]">
              <th className="text-left font-semibold py-2 pr-2">DESCRIZIONE</th>
              <th className="text-center font-semibold py-2 w-10">QTÀ</th>
              <th className="text-right font-semibold py-2 w-28">PREZZO UNITARIO (€)</th>
              <th className="text-right font-semibold py-2 w-24">TOTALE (€)</th>
              <th className="text-center font-semibold py-2 w-14">IVA</th>
            </tr>
          </thead>
          <tbody>
            {items.map(row => {
              const qty = Math.round(Number(row.quantity))
              const tot = qty * Number(row.unit_price)
              return (
                <tr key={row.id} className="border-b border-neutral-200 align-top">
                  <td className="py-3 pr-3 leading-4">{row.name}</td>
                  <td className="py-3 text-center">{qty}</td>
                  <td className="py-3 text-right">{Number(row.unit_price).toLocaleString('it-IT', { minimumFractionDigits: 2 })} €</td>
                  <td className="py-3 text-right">{tot.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €</td>
                  <td className="py-3 text-center">22.0 %</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="mt-10 border-t border-neutral-300 pt-6 flex justify-end">
          <div className="text-right">
            <p className="text-neutral-500 text-[11px]">Imponibile</p>
            <p className="text-2xl font-semibold">
              {imponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €
            </p>
            <p className="text-neutral-500 text-[11px]">+ IVA</p>
          </div>
        </div>

        {quote.footer_notes && (
          <div className="mt-10 text-[11px] leading-5 whitespace-pre-wrap uppercase">
            {quote.footer_notes}
          </div>
        )}

        <p className="mt-3 text-[11px] font-semibold uppercase">
          IL PRESENTE PREVENTIVO HA VALIDITA' FINO AL {format(validita, 'dd MMMM yyyy', { locale: it }).toUpperCase()}
        </p>

        <div className="grid grid-cols-2 gap-20 mt-20 text-[11px]">
          <div>
            <p className="text-neutral-500 mb-12">Firma cliente per accettazione</p>
            <p className="uppercase">{client?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-neutral-500 mb-12">Firma emittente</p>
            <p>Nps - Nuovo Punto Sicurezza snc</p>
          </div>
        </div>

        <footer className="mt-16 pt-4 flex justify-between items-end text-[10px] text-neutral-500">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
            <div>
              <p className="font-semibold text-neutral-700">Nuovo Punto Sicurezza Snc</p>
              <p>www.nuovopuntosicurezza.com · nuovopuntosicurezza@gmail.com</p>
              <p>Tel: 338637982018</p>
            </div>
          </div>
          <p>PREVENTIVO Nr. {quote.quote_number}</p>
        </footer>
      </article>
    </div>
  )
}