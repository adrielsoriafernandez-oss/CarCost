import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import './index.css';

// Porcentajes de depreciación por años de uso (Tabla BOE)
const DEPRECIACION_BOE = {
  0: 1.00, 1: 0.84, 2: 0.67, 3: 0.56, 4: 0.47,
  5: 0.39, 6: 0.34, 7: 0.28, 8: 0.24, 9: 0.19, 10: 0.17
};

function calcularImpuestoMatriculacion(co2) {
  if (!co2 || co2 <= 120) return 0.0;
  if (co2 >= 121 && co2 <= 159) return 4.75;
  if (co2 >= 160 && co2 <= 199) return 9.75;
  return 14.75;
}

function App() {
  const [marcas, setMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [marcaSeleccionada, setMarcaSeleccionada] = useState('');
  const [modeloSeleccionado, setModeloSeleccionado] = useState('');
  
  // Datos técnicos del coche
  const [cocheData, setCocheData] = useState(null);
  
  // Calculadora
  const [precioOrigen, setPrecioOrigen] = useState(30000);
  const [antiguedad, setAntiguedad] = useState(3);
  const [resultados, setResultados] = useState(null);
  
  // Estado UI
  const [loading, setLoading] = useState(true);

  // 1. Cargar marcas iniciales
  useEffect(() => {
    async function loadMarcas() {
      const { data, error } = await supabase.from('marcas').select('*').order('nombre');
      if (data) setMarcas(data);
      setLoading(false);
    }
    loadMarcas();
  }, []);

  // 2. Cargar modelos al seleccionar marca
  useEffect(() => {
    if (!marcaSeleccionada) {
      setModelos([]);
      setModeloSeleccionado('');
      return;
    }
    async function loadModelos() {
      setLoading(true);
      const { data } = await supabase.from('modelos')
        .select('*')
        .eq('marca_id', marcaSeleccionada)
        .order('nombre');
      if (data) setModelos(data);
      setLoading(false);
    }
    loadModelos();
  }, [marcaSeleccionada]);

  // 3. Cargar datos del modelo seleccionado (CO2, Consumo, Seguros)
  useEffect(() => {
    if (!modeloSeleccionado) {
      setCocheData(null);
      return;
    }
    async function loadCocheData() {
      // Obtener datos técnicos
      const { data: modData } = await supabase.from('modelos')
        .select('*')
        .eq('id', modeloSeleccionado)
        .single();
        
      // Intentar obtener precio de seguro de prueba si existe
      const { data: segData } = await supabase.from('seguros')
        .select('precio_anual')
        .eq('modelo_id', modeloSeleccionado)
        .limit(1);
        
      setCocheData({
        ...modData,
        seguro_estimado: segData?.length > 0 ? segData[0].precio_anual : "No disponible"
      });
    }
    loadCocheData();
  }, [modeloSeleccionado]);

  // 4. Lógica Matemática del BOE en Tiempo Real
  useEffect(() => {
    if (!cocheData || !precioOrigen) return;
    
    // Valor Hacienda
    const depreciacion = DEPRECIACION_BOE[antiguedad > 10 ? 10 : antiguedad];
    const valorHacienda = precioOrigen * depreciacion;
    
    // Impuesto Matriculación
    const co2 = cocheData.emisiones_co2 || 0;
    const porcentajeIm = calcularImpuestoMatriculacion(co2);
    const importeIm = valorHacienda * (porcentajeIm / 100);
    
    // Tasas
    const tasaDgt = 99.77;
    const totalCoste = importeIm + tasaDgt;
    
    setResultados({
      valorHacienda,
      porcentajeIm,
      importeIm,
      totalCoste
    });
  }, [cocheData, precioOrigen, antiguedad]);

  return (
    <>
      <h1>CarCost Analytics</h1>
      <p className="subtitle">Portal avanzado de cálculo fiscal y seguros (Basado en BOE)</p>

      <div className="dashboard">
        {/* PANEL IZQUIERDO: BUSCADOR */}
        <div className="glass-panel">
          <h2>🔍 Buscador</h2>
          
          <div className="form-group">
            <label>1. Selecciona Fabricante</label>
            <select 
              value={marcaSeleccionada} 
              onChange={e => setMarcaSeleccionada(e.target.value)}
              disabled={loading && marcas.length === 0}
            >
              <option value="">-- Elige una marca --</option>
              {marcas.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>2. Selecciona Modelo</label>
            <select 
              value={modeloSeleccionado} 
              onChange={e => setModeloSeleccionado(e.target.value)}
              disabled={!marcaSeleccionada || loading}
            >
              <option value="">-- Elige un modelo --</option>
              {modelos.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>

          <hr style={{borderColor: 'var(--border-color)', margin: '2rem 0'}} />
          
          <h2>💶 Datos Base</h2>
          <div className="form-group">
            <label>Precio de compra origen (€)</label>
            <input 
              type="number" 
              value={precioOrigen} 
              onChange={e => setPrecioOrigen(Number(e.target.value))} 
            />
          </div>
          
          <div className="form-group">
            <label>Años de antigüedad</label>
            <input 
              type="number" 
              min="0" max="20"
              value={antiguedad} 
              onChange={e => setAntiguedad(Number(e.target.value))} 
            />
          </div>
        </div>

        {/* PANEL DERECHO: RESULTADOS */}
        {cocheData ? (
          <div className="glass-panel" style={{animationDelay: '0.1s'}}>
            <h2>📊 Ficha Técnica y Fiscal: {cocheData.nombre}</h2>
            
            <div className="results-grid">
              <div className="metric-card">
                <div className="metric-label">Emisiones CO2</div>
                <div className="metric-value">{cocheData.emisiones_co2 || 0} <span className="metric-unit">g/km</span></div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Consumo Est.</div>
                <div className="metric-value">{cocheData.consumo_l_100km || 0} <span className="metric-unit">L/100km</span></div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Tramo BOE (I.M.)</div>
                <div className="metric-value">{resultados?.porcentajeIm}%</div>
              </div>
            </div>

            {resultados && (
              <>
                <h2>💸 Desglose de Gastos de Importación</h2>
                <div style={{color: 'var(--text-muted)', marginBottom: '1rem'}}>
                  <p>Valor fiscal (Hacienda): <strong>{resultados.valorHacienda.toLocaleString('es-ES')} €</strong></p>
                  <p>Impuesto Matriculación ({resultados.porcentajeIm}%): <strong>{resultados.importeIm.toLocaleString('es-ES')} €</strong></p>
                  <p>Tasas DGT: <strong>99,77 €</strong></p>
                  <p>Seguro Anual Mínimo (Bot): <strong>{typeof cocheData.seguro_estimado === 'number' ? cocheData.seguro_estimado + ' €' : cocheData.seguro_estimado}</strong></p>
                </div>

                <div className="total-box">
                  <div className="total-label">Coste Legal de Importación</div>
                  <div className="total-value">{resultados.totalCoste.toLocaleString('es-ES', {maximumFractionDigits: 2})} €</div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5}}>
            <p>Selecciona un vehículo para ver su calculadora BOE...</p>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
