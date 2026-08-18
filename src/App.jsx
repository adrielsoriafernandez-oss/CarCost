import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import CarPanel from './CarPanel';
import AuthPanel from './AuthPanel';
import './index.css';

function App() {
  const [marcas, setMarcas] = useState([]);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [user, setUser] = useState(null);

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
          <h1>CarCost Analytics v5</h1>
          <p className="subtitle">Portal avanzado de importación SaaS</p>
        </div>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
          <button 
            className={`btn-toggle-vs ${isComparisonMode ? 'active' : ''}`}
            onClick={() => setIsComparisonMode(!isComparisonMode)}
          >
            {isComparisonMode ? 'Cerrar Modo VS' : 'Modo Comparativa ⚔️'}
          </button>
        </div>
      </div>
      
      <div style={{maxWidth:'1400px', margin:'0 auto 2rem auto'}}>
        <AuthPanel user={user} setUser={setUser} />
      </div>

      <div className={`dashboard-container ${isComparisonMode ? 'vs-mode' : 'single-mode'}`}>
        <CarPanel panelId="1" marcas={marcas} user={user} />
        {isComparisonMode && <CarPanel panelId="2" marcas={marcas} user={user} />}
      </div>
    </>
  );
}

export default App;
