import { useState, useEffect } from 'react';
import { supabase } from './supabase';

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
      else alert("Revisa tu correo para confirmar el registro (si tienes el email confirm activado en Supabase, sino ya estás logueado).");
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (user) {
    return (
      <div className="auth-box">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span style={{color:'var(--success)', fontWeight:'bold'}}>👤 {user.email}</span>
          <div style={{display:'flex', gap:'10px'}}>
            <button className="btn-secondary" style={{padding:'0.5rem', marginTop:0}} onClick={() => setVerGaraje(!verGaraje)}>
              {verGaraje ? 'Ocultar Garaje' : '❤️ Mi Garaje'}
            </button>
            <button className="btn-secondary" style={{padding:'0.5rem', marginTop:0}} onClick={handleLogout}>Salir</button>
          </div>
        </div>

        {verGaraje && (
          <div style={{marginTop:'1rem', borderTop:'1px solid var(--border-color)', paddingTop:'1rem'}}>
            <h3>Mis Coches Guardados</h3>
            {garaje.length === 0 ? <p style={{color:'var(--text-muted)'}}>No tienes presupuestos guardados.</p> : (
              <ul style={{listStyle:'none', padding:0}}>
                {garaje.map(g => (
                  <li key={g.id} style={{background:'rgba(0,0,0,0.2)', padding:'1rem', borderRadius:'8px', marginBottom:'0.5rem', display:'flex', justifyContent:'space-between'}}>
                    <div>
                      <strong>{g.coche_nombre}</strong>
                      <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{new Date(g.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{fontWeight:'bold', color:'var(--success)'}}>{g.presupuesto_total.toLocaleString()} €</div>
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
    <div className="auth-box">
      <form onSubmit={handleAuth} style={{display:'flex', gap:'10px', alignItems:'flex-end'}}>
        <div style={{flex:1}}>
          <label>Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{flex:1}}>
          <label>Contraseña</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" style={{flex:1, marginTop:0}} disabled={loading}>
          {loading ? 'Cargando...' : (isLogin ? 'Entrar' : 'Registrarse')}
        </button>
      </form>
      <div style={{marginTop:'0.5rem', fontSize:'0.8rem', textAlign:'right'}}>
        <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }} style={{color:'var(--accent)'}}>
          {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </a>
      </div>
    </div>
  );
}
