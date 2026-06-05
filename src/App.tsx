import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function App() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [info, setInfo] = useState('')

  useEffect(() => {
    async function testConnection() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('count')
          .limit(1)

        if (error) {
          setStatus('error')
          setInfo(error.message)
        } else {
          setStatus('ok')
          setInfo('Conexão com Supabase funcionando!')
        }
      } catch (err) {
        setStatus('error')
        setInfo(String(err))
      }
    }

    testConnection()
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Entre Aulas — Teste de Conexão</h1>
      {status === 'loading' && <p>🔄 Conectando ao Supabase...</p>}
      {status === 'ok' && <p style={{ color: 'green' }}>✅ {info}</p>}
      {status === 'error' && <p style={{ color: 'red' }}>❌ Erro: {info}</p>}
    </div>
  )
}