import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import CarPanel from './CarPanel';
import AuthPanel from './AuthPanel';
import './index.css';

// Minimalist SVGs
const MoonIcon = () => (<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>);
const SunIcon = () => (<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>);
const UserIcon = () => (<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>);
const CompareIcon = () => (<svg viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="14" x2="21" y2="3"></line><polyline points="8 21 3 21 3 16"></polyline><line x1="20" y1="10" x2="3" y2="21"></line></svg>);

function App() {
  const [marcas, setMarcas] = useState([]);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [user, setUser] = useState(null);
  
  const [view, setView] = useState('home'); // 'home' | 'login'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    async function loadMarcas() {
      const { data } = await supabase.from('marcas').select('*').order('nombre');
      if (data) setMarcas(data);
    }
    loadMarcas();
  }, []);

  return (
    <div className="app-container">
      <header className="top-nav">
        <div className="nav-left">
          <span className="nav-brand">CarCost</span>
          <span className="nav-badge">v10</span>
        </div>
        <div className="nav-actions">
          <button 
            className="btn-ghost" 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          
          {view === 'home' && (
            <button 
              className="btn-ghost" 
              onClick={() => setView('login')}
            >
              <UserIcon />
              {user ? user.email.split('@')[0] : 'Log in'}
            </button>
          )}

          {view === 'home' && (
            <button 
              className="btn-secondary"
              onClick={() => setIsComparisonMode(!isComparisonMode)}
            >
              <CompareIcon />
              {isComparisonMode ? 'Cerrar comparativa' : 'Comparar vehículos'}
            </button>
          )}
        </div>
      </header>
      
      <main className="main-wrapper">
        {view === 'login' && (
          <div className="auth-container">
            <button className="text-link" style={{marginBottom: 'var(--space-5)'}} onClick={() => setView('home')}>
              &larr; Volver
            </button>
            <AuthPanel user={user} setUser={setUser} />
          </div>
        )}

        {view === 'home' && (
          <>
            <div className="page-header">
              <h1>Calculadora de costes de importación</h1>
              <p>Desglose preciso de impuestos, tasas y seguros para vehículos de importación en España.</p>
            </div>
            
            <div className={isComparisonMode ? 'comparison-grid' : ''}>
              <CarPanel panelId="1" marcas={marcas} user={user} isComparisonMode={isComparisonMode} />
              {isComparisonMode && <CarPanel panelId="2" marcas={marcas} user={user} isComparisonMode={isComparisonMode} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
