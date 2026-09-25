import { Outlet, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Layout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="no-print bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg">Preventivi</Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/" className="hover:underline">Lista</Link>
          <Link to="/catalogo" className="hover:underline">Materiali</Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              navigate('/login')
            }}
          >
            Esci
          </button>
        </nav>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}