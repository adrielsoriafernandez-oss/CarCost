import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import './index.css';

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
  const [cocheData, setCocheData] = useState(null);
  
  const [precioOrigen, setPrecioOrigen] = useState(30000);
  const [antiguedad, setAntiguedad] = useState(3);
  const [resultados, setResultados] = useState(null);
  
  // Nuevos estados para Viaje
  const [calcularViaje, setCalcularViaje] = useState(false);
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [viajeLoading, setViajeLoading] = useState(false);
  const [datosViaje, setDatosViaje] = useState(null);

  const [loading, setLoading] = useState(true);
  const PRECIO_GASOLINA = 1.60;

  useEffect(() => {
    async function loadMarcas() {
      const { data } = await supabase.from('marcas').select('*').order('nombre');
      if (data) setMarcas(data);
      setLoading(false);
    }
    loadMarcas();
  }, []);

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

  useEffect(() => {
    if (!modeloSeleccionado) {
      setCocheData(null);
      setDatosViaje(null);
      return;
    }
    async function loadCocheData() {
      const { data: modData } = await supabase.from('modelos')
        .select('*')
        .eq('id', modeloSeleccionado)
        .single();
        
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

  // Función para obtener coordenadas (OpenStreetMap)
  async function getCoordinates(city) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`);
    const data = await res.json();
    if (data && data.length > 0) return { lat: data[0].lat, lon: data[0].lon };
    return null;
  }

  // Función para calcular ruta (OSRM)
  async function calcularRutaViaje() {
    if (!origen || !destino || !cocheData) return;
    setViajeLoading(true);
    setDatosViaje(null);

    try {
      const coordsOrigen = await getCoordinates(origen);
      const coordsDestino = await getCoordinates(destino);

      if (!coordsOrigen || !coordsDestino) {
        alert("No se pudo encontrar una de las ciudades en el mapa.");
        setViajeLoading(false);
        return;
      }

      // OSRM espera long,lat
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsOrigen.lon},${coordsOrigen.lat};${coordsDestino.lon},${coordsDestino.lat}?overview=false`;
      const resRuta = await fetch(osrmUrl);
      const dataRuta = await resRuta.json();

      if (dataRuta.code === 'Ok') {
        const distanciaMetros = dataRuta.routes[0].distance;
        const distanciaKm = distanciaMetros / 1000;
        
        // Matemáticas de Gasolina
        const consumoL = cocheData.consumo_l_100km || 0;
        const costeGasolina = (distanciaKm / 100) * consumoL * PRECIO_GASOLINA;

        setDatosViaje({
          distancia: Math.round(distanciaKm),
          costeGasolina: costeGasolina
        });
      }
    } catch (e) {
      alert("Error al contactar con el servicio de mapas.");
    }
    setViajeLoading(false);
  }

  useEffect(() => {
    if (!cocheData || !precioOrigen) return;
    const depreciacion = DEPRECIACION_BOE[antiguedad > 10 ? 10 : antiguedad];
    const valorHacienda = precioOrigen * depreciacion;
    const co2 = cocheData.emisiones_co2 || 0;
    const porcentajeIm = calcularImpuestoMatriculacion(co2);
    const importeIm = valorHacienda * (porcentajeIm / 100);
    const tasaDgt = 99.77;
    
    // Sumar gasolina si la hemos calculado
    let costeGasolinaViaje = 0;
    if (calcularViaje && datosViaje) {
      costeGasolinaViaje = datosViaje.costeGasolina;
    }

    const totalCoste = importeIm + tasaDgt + costeGasolinaViaje;
    
    setResultados({
      valorHacienda, porcentajeIm, importeIm, tasaDgt, costeGasolinaViaje, totalCoste
    });
  }, [cocheData, precioOrigen, antiguedad, datosViaje, calcularViaje]);

  return (
    <>
      <h1>CarCost Analytics</h1>
      <p className="subtitle">Portal avanzado de cálculo fiscal, seguros y viaje</p>

      <div className="dashboard">
        <div className="glass-panel">
          <h2>🔍 Búsqueda y Datos</h2>
          
          <div className="form-group">
            <label>Fabricante</label>
            <select value={marcaSeleccionada} onChange={e => setMarcaSeleccionada(e.target.value)} disabled={loading && marcas.length === 0}>
              <option value="">-- Elige una marca --</option>
              {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Modelo</label>
            <select value={modeloSeleccionado} onChange={e => setModeloSeleccionado(e.target.value)} disabled={!marcaSeleccionada || loading}>
              <option value="">-- Elige un modelo --</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>

          <hr style={{borderColor: 'var(--border-color)', margin: '1.5rem 0'}} />
          
          <div className="form-group">
            <label>Precio de compra origen (€)</label>
            <input type="number" value={precioOrigen} onChange={e => setPrecioOrigen(Number(e.target.value))} />
          </div>
          
          <div className="form-group">
            <label>Años de antigüedad</label>
            <input type="number" min="0" max="20" value={antiguedad} onChange={e => setAntiguedad(Number(e.target.value))} />
          </div>

          <hr style={{borderColor: 'var(--border-color)', margin: '1.5rem 0'}} />
          
          {/* MÓDULO VIAJE OPICIONAL */}
          <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input type="checkbox" id="checkViaje" style={{width:'auto'}} checked={calcularViaje} onChange={(e) => setCalcularViaje(e.target.checked)} />
            <label htmlFor="checkViaje" style={{margin:0, color:'white', textTransform:'none'}}>Quiero traerlo conduciendo</label>
          </div>

          {calcularViaje && (
            <div style={{background: 'rgba(0,0,0,0.2)', padding:'1rem', borderRadius:'8px', marginTop:'1rem'}}>
              <div className="form-group">
                <label>Ciudad de Origen (Ej: Múnich)</label>
                <input type="text" placeholder="Ej: Múnich, Alemania" value={origen} onChange={e => setOrigen(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Ciudad de Destino (España)</label>
                <input type="text" placeholder="Ej: Madrid, España" value={destino} onChange={e => setDestino(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={calcularRutaViaje} disabled={viajeLoading || !cocheData}>
                {viajeLoading ? 'Satélites calculando ruta...' : 'Calcular Ruta y Gasolina'}
              </button>
            </div>
          )}
        </div>

        {cocheData ? (
          <div className="glass-panel" style={{animationDelay: '0.1s'}}>
            <h2>📊 Ficha: {cocheData.nombre}</h2>
            
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

            {datosViaje && calcularViaje && (
              <div style={{marginBottom:'2rem', padding:'1rem', border:'1px solid var(--accent)', borderRadius:'8px', background:'rgba(59, 130, 246, 0.1)'}}>
                <h3 style={{fontSize:'1rem', marginBottom:'0.5rem'}}>🗺️ Detalles del Viaje a España</h3>
                <p>Distancia detectada: <strong>{datosViaje.distancia} Kilómetros</strong></p>
                <p>Precio gasolina fijado: <strong>1.60 €/Litro</strong></p>
                <p style={{marginTop:'0.5rem'}}>Coste estimado de combustible: <strong style={{color:'var(--accent)'}}>{datosViaje.costeGasolina.toLocaleString('es-ES', {maximumFractionDigits:2})} €</strong></p>
              </div>
            )}

            {resultados && (
              <>
                <h2>💸 Gastos de Importación</h2>
                <div style={{color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.8'}}>
                  <p>Valor tasación (Hacienda): <strong>{resultados.valorHacienda.toLocaleString('es-ES')} €</strong></p>
                  <p>Impuesto Matriculación ({resultados.porcentajeIm}%): <strong style={{color:'white'}}>{resultados.importeIm.toLocaleString('es-ES')} €</strong></p>
                  <p>Tasas fijas DGT: <strong style={{color:'white'}}>99,77 €</strong></p>
                  {calcularViaje && datosViaje && (
                    <p>Gasolina del Viaje: <strong style={{color:'white'}}>{resultados.costeViajeGasolina?.toLocaleString('es-ES', {maximumFractionDigits:2}) || datosViaje.costeGasolina.toLocaleString('es-ES', {maximumFractionDigits:2})} €</strong></p>
                  )}
                  <p>Seguro Anual Mínimo (Bot): <strong style={{color:'white'}}>{typeof cocheData.seguro_estimado === 'number' ? cocheData.seguro_estimado + ' €' : cocheData.seguro_estimado}</strong></p>
                </div>

                <div className="total-box">
                  <div className="total-label">Coste Legal + Viaje Total</div>
                  <div className="total-value">{resultados.totalCoste.toLocaleString('es-ES', {maximumFractionDigits: 2})} €</div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5}}>
            <p>Selecciona un vehículo para ver su ficha y calculadora...</p>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
