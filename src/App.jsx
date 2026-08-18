import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import CarPanel from './CarPanel';
import AuthPanel from './AuthPanel';
import './index.css';

function App() {
  const [marcas, setMarcas] = useState([]);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [user, setUser] = useState(null);
  
  // v6 Routing
  const [view, setView] = useState('home'); // 'home' | 'login'

  useEffect(() => {
    async function loadMarcas() {
      const { data } = await supabase.from('marcas').select('*').order('nombre');
      if (data) setMarcas(data);
    }
    loadMarcas();
  }, []);

  return (
    <>
      <div className="header-bar">
        <div>
          <h1>CarCost Analytics v6</h1>
          <p className="subtitle">Portal avanzado de importación SaaS</p>
        </div>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
          {view === 'home' && (
            <button 
              className="btn-toggle-vs" 
              style={{borderColor: 'var(--success)'}}
              onClick={() => setView('login')}
            >
              {user ? `👤 Mi Cuenta (${user.email.split('@')[0]})` : '👤 Iniciar Sesión'}
            </button>
          )}
          {view === 'home' && (
            <button 
              className={`btn-toggle-vs ${isComparisonMode ? 'active' : ''}`}
              onClick={() => setIsComparisonMode(!isComparisonMode)}
            >
              {isComparisonMode ? 'Cerrar Modo VS' : 'Modo Comparativa ⚔️'}
            </button>
          )}
        </div>
      </div>
      
      {view === 'login' && (
        <div style={{maxWidth:'700px', margin:'0 auto'}}>
          <button className="btn-secondary" style={{marginBottom:'1rem'}} onClick={() => setView('home')}>
            ← Volver al Buscador
          </button>
          <AuthPanel user={user} setUser={setUser} />
        </div>
      )}

      {view === 'home' && (
        <div className={`dashboard-container ${isComparisonMode ? 'vs-mode' : 'single-mode'}`}>
          <CarPanel panelId="1" marcas={marcas} user={user} />
          {isComparisonMode && <CarPanel panelId="2" marcas={marcas} user={user} />}
        </div>
      )}
    </>
  );
}

export default App;
