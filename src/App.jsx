import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import CarPanel from './CarPanel';
import './index.css';

function App() {
  const [marcas, setMarcas] = useState([]);
  const [isComparisonMode, setIsComparisonMode] = useState(false);

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
          <h1>CarCost Analytics v4</h1>
          <p className="subtitle">Portal avanzado de importación con Modo Comparativa</p>
        </div>
        <button 
          className={`btn-toggle-vs ${isComparisonMode ? 'active' : ''}`}
          onClick={() => setIsComparisonMode(!isComparisonMode)}
        >
          {isComparisonMode ? 'Desactivar Modo VS' : 'Activar Modo Comparativa ⚔️'}
        </button>
      </div>

      <div className={`dashboard-container ${isComparisonMode ? 'vs-mode' : 'single-mode'}`}>
        <CarPanel panelId="1" marcas={marcas} />
        {isComparisonMode && <CarPanel panelId="2" marcas={marcas} />}
      </div>
    </>
  );
}

export default App;
