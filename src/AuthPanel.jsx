import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const HeartIcon = () => (<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>);
const LogOutIcon = () => (<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>);

export default function AuthPanel({ user, setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [garaje, setGaraje] = useState([]);
  const [verGaraje, setVerGaraje] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [setUser]);

  useEffect(() => {
    if (user && verGaraje) {
      cargarGaraje();
    }
  }, [user, verGaraje]);

  async function cargarGaraje() {
    const { data } = await supabase.from('garaje').select('*').order('created_at', { ascending: false });
    if (data) setGaraje(data);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert("Revisa tu correo para confirmar el registro (si tienes el email confirm activado).");
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (user) {
    return (
      <div>
        <div className="auth-header">
          <h1>{user.email}</h1>
          <p>Cuenta conectada</p>
        </div>

        <div style={{display:'flex', gap:'var(--space-3)', justifyContent:'center', marginBottom:'var(--space-6)'}}>
          <button className="btn-secondary" onClick={() => setVerGaraje(!verGaraje)}>
            <HeartIcon />
            {verGaraje ? 'Ocultar presupuestos' : 'Presupuestos guardados'}
          </button>
          <button className="btn-ghost" onClick={handleLogout} aria-label="Log out">
            <LogOutIcon />
          </button>
        </div>

        {verGaraje && (
          <div>
            <h3 style={{borderBottom:'1px solid var(--border-color)', paddingBottom:'var(--space-2)', marginBottom:'var(--space-4)'}}>Historial</h3>
            {garaje.length === 0 ? (
              <p>No tienes presupuestos guardados.</p>
            ) : (
              <ul className="saved-list">
                {garaje.map(g => (
                  <li key={g.id} className="saved-item">
                    <div>
                      <div className="title">{g.coche_nombre}</div>
                      <div className="date">{new Date(g.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="amount">{g.presupuesto_total.toLocaleString()} €</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="auth-header">
        <h1>{isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <p>{isLogin ? 'Accede a tu historial de presupuestos' : 'Guarda tus presupuestos para el futuro'}</p>
      </div>

      <form onSubmit={handleAuth} style={{display:'flex', flexDirection:'column', gap:'var(--space-4)'}}>
        <div className="form-group">
          <label>Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
        </div>
        <div className="form-group">
          <label>Contraseña</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <button type="submit" className="btn-primary" disabled={loading} style={{marginTop: 'var(--space-2)'}}>
          {loading ? 'Procesando...' : (isLogin ? 'Entrar' : 'Continuar')}
        </button>
      </form>

      <div style={{marginTop:'var(--space-5)', textAlign:'center'}}>
        <button className="text-link" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  );
}
