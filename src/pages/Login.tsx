import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o password non validi')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">Preventivi</h1>
        <p className="text-center text-sm text-slate-500">Stesso accesso del team</p>
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
        <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-2 rounded-lg disabled:opacity-50">
          {loading ? 'Accesso...' : 'Accedi'}
        </button>
      </form>
    </div>
  )
}