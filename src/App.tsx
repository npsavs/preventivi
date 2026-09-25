import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Layout from './components/Layout'
import Lista from './pages/Lista'
import Catalogo from './pages/Catalogo'
import Editor from './pages/Editor'
import Stampa from './pages/Stampa'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="p-10 text-center">Caricamento...</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Lista />} />
          <Route path="catalogo" element={<Catalogo />} />
          <Route path="nuovo" element={<Editor />} />
          <Route path="preventivo/:id" element={<Editor />} />
          <Route path="stampa/:id" element={<Stampa />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App