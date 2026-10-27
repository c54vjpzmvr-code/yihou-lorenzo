import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type { Session } from '@supabase/supabase-js'
import App from './App'
import AuthPanel from './AuthPanel'
import { cloud } from './cloud'
import './styles.css'

function Root() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(cloud))
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!cloud) return
    const supabase = cloud
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
    })
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => subscription.unsubscribe()
  }, [])

  if (!cloud) return <App session={null} />
  if (loading) return <div className="auth-loading" role="status">正在打开衣橱…</div>
  if (recovering) return <AuthPanel recovery onRecovered={() => setRecovering(false)} />
  if (!session) return <AuthPanel />
  return <App key={session.user.id} session={session} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
