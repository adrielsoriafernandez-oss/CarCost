import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import html2pdf from 'html2pdf.js';

const DEPRECIACION_BOE = {
  0: 1.00, 1: 0.84, 2: 0.67, 3: 0.56, 4: 0.47,
  5: 0.39, 6: 0.34, 7: 0.28, 8: 0.24, 9: 0.19, 10: 0.17
};

const COSTES_FIJOS = {
  itv: 150,
  placas: 30,
  traduccion: 80,
  tasaDgt: 99.77
};
const TOTAL_TRAMITES = COSTES_FIJOS.itv + COSTES_FIJOS.placas + COSTES_FIJOS.traduccion + COSTES_FIJOS.tasaDgt;
const PRECIO_GASOLINA = 1.60;

function getEtiquetaDGT(co2, antiguedad) {
  if (co2 === 0) return { label: 'CERO', color: '#005a9e', bg: '#e0f2fe' }; // Azul
  if (antiguedad < 8) return { label: 'C', color: '#166534', bg: '#dcfce7' }; // Verde
  if (antiguedad >= 8 && antiguedad < 18) return { label: 'B', color: '#854d0e', bg: '#fef08a' }; // Amarilla
  return { label: 'SIN ETIQUETA (A)', color: '#7f1d1d', bg: '#fecaca' }; // Roja
}

export default function CarPanel({ panelId, marcas }) {
  const [modelos, setModelos] = useState([]);
  const [marcaBusqueda, setMarcaBusqueda] = useState('');
  const [marcaSeleccionada, setMarcaSeleccionada] = useState(null);
  const [modeloBusqueda, setModeloBusqueda] = useState('');
  const [modeloSeleccionado, setModeloSeleccionado] = useState(null);
  
  const [cocheData, setCocheData] = useState(null);
  const [cargandoBusqueda, setCargandoBusqueda] = useState(false);
  
  const [precioOrigen, setPrecioOrigen] = useState(30000);
  const [antiguedad, setAntiguedad] = useState(3);
  const [resultados, setResultados] = useState(null);
  
  const [calcularViaje, setCalcularViaje] = useState(false);
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [viajeLoading, setViajeLoading] = useState(false);
  const [datosViaje, setDatosViaje] = useState(null);

  const [loadingModelos, setLoadingModelos] = useState(false);

  useEffect(() => {
    if (!marcaSeleccionada) {
      setModelos([]);
      setModeloBusqueda('');
      setModeloSeleccionado(null);
      return;
    }
    async function loadModelos() {
      setLoadingModelos(true);
      const { data } = await supabase.from('modelos')
        .select('*')
        .eq('marca_id', marcaSeleccionada)
        .order('nombre');
      if (data) setModelos(data);
      setLoadingModelos(false);
    }
    loadModelos();
  }, [marcaSeleccionada]);

  async function handleBuscar() {
    if (!modeloSeleccionado) {
      alert("Selecciona un modelo.");
      return;
    }
    setCargandoBusqueda(true);
    setDatosViaje(null);
    
    const { data: modData } = await supabase.from('modelos').select('*').eq('id', modeloSeleccionado).single();
    const { data: segData } = await supabase.from('seguros').select('precio_anual').eq('modelo_id', modeloSeleccionado).limit(1);
      
    setCocheData({
      ...modData,
      seguro_estimado: segData?.length > 0 ? segData[0].precio_anual : "No disp."
    });
    setCargandoBusqueda(false);
  }

  async function getCoordinates(city) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (data && data.length > 0) return { lat: data[0].lat, lon: data[0].lon };
    } catch(e) { }
    return null;
  }

  async function calcularRutaViaje() {
    if (!origen || !destino || !cocheData) return;
    setViajeLoading(true);
    const coordsOrigen = await getCoordinates(origen);
    const coordsDestino = await getCoordinates(destino);

    if (coordsOrigen && coordsDestino) {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsOrigen.lon},${coordsOrigen.lat};${coordsDestino.lon},${coordsDestino.lat}?overview=false`;
      try {
        const resRuta = await fetch(osrmUrl);
        const dataRuta = await resRuta.json();
        if (dataRuta.code === 'Ok') {
          const distKm = dataRuta.routes[0].distance / 1000;
          const consumoL = cocheData.consumo_l_100km || 0;
          const costeGas = (distKm / 100) * consumoL * PRECIO_GASOLINA;
          setDatosViaje({ distancia: Math.round(distKm), costeGasolina: costeGas });
        }
      } catch(e) {}
    } else {
      alert("Ruta no encontrada.");
    }
    setViajeLoading(false);
  }

  useEffect(() => {
    if (!cocheData || !precioOrigen) return;
    const co2 = cocheData.emisiones_co2 || 0;
    
    let porcentajeIm = 0;
    if (co2 > 120 && co2 <= 159) porcentajeIm = 4.75;
    else if (co2 >= 160 && co2 <= 199) porcentajeIm = 9.75;
    else if (co2 >= 200) porcentajeIm = 14.75;

    const depreciacion = DEPRECIACION_BOE[antiguedad > 10 ? 10 : antiguedad];
    const valorHacienda = precioOrigen * depreciacion;
    const importeIm = valorHacienda * (porcentajeIm / 100);
    
    const costeViajeGasolina = (calcularViaje && datosViaje) ? datosViaje.costeGasolina : 0;
    const totalCosteExtra = importeIm + TOTAL_TRAMITES + costeViajeGasolina;
    const totalPresupuesto = precioOrigen + totalCosteExtra;
    const etiqueta = getEtiquetaDGT(co2, antiguedad);
    
    setResultados({
      valorHacienda, porcentajeIm, importeIm, costeViajeGasolina, totalCosteExtra, totalPresupuesto, etiqueta
    });
  }, [cocheData, precioOrigen, antiguedad, datosViaje, calcularViaje]);

  const chartData = resultados ? [
    { name: 'Precio Coche', value: precioOrigen, color: '#94a3b8' },
    { name: 'Impuestos (I.M.)', value: resultados.importeIm, color: '#ef4444' },
    { name: 'Trámites + Tasas', value: TOTAL_TRAMITES, color: '#f59e0b' },
    { name: 'Viaje (Gasolina)', value: resultados.costeViajeGasolina, color: '#3b82f6' }
  ].filter(item => item.value > 0) : [];

  const handleDownloadPDF = () => {
    const element = document.getElementById(`pdf-content-${panelId}`);
    const opt = {
      margin:       10,
      filename:     `Presupuesto_Importacion_${cocheData?.nombre || 'Coche'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="panel-wrapper">
      <div className="glass-panel search-panel">
        <h2>🔍 Vehículo {panelId}</h2>
        <div className="form-group">
          <label>Marca</label>
          <input type="text" list={`marcas-list-${panelId}`} value={marcaBusqueda}
            onChange={e => {
              setMarcaBusqueda(e.target.value);
              const m = marcas.find(x => x.nombre === e.target.value);
              setMarcaSeleccionada(m ? m.id : null);
            }} />
          <datalist id={`marcas-list-${panelId}`}>
            {marcas.map(m => <option key={m.id} value={m.nombre} />)}
          </datalist>
        </div>
        <div className="form-group">
          <label>Modelo</label>
          <input type="text" list={`modelos-list-${panelId}`} value={modeloBusqueda} disabled={!marcaSeleccionada || loadingModelos}
            onChange={e => {
              setModeloBusqueda(e.target.value);
              const m = modelos.find(x => x.nombre === e.target.value);
              setModeloSeleccionado(m ? m.id : null);
            }} />
          <datalist id={`modelos-list-${panelId}`}>
            {modelos.map(m => <option key={m.id} value={m.nombre} />)}
          </datalist>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Precio Origen (€)</label>
            <input type="number" value={precioOrigen} onChange={e => setPrecioOrigen(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Antigüedad (Años)</label>
            <input type="number" min="0" value={antiguedad} onChange={e => setAntiguedad(Number(e.target.value))} />
          </div>
        </div>

        <div className="form-group">
          <label style={{display:'flex', alignItems:'center', gap:'10px', color:'white', cursor:'pointer'}}>
            <input type="checkbox" checked={calcularViaje} onChange={e => setCalcularViaje(e.target.checked)} style={{width:'auto'}} />
            Traer conduciendo
          </label>
        </div>
        
        {calcularViaje && (
          <div className="travel-box">
            <input type="text" placeholder="Origen (ej: Berlín)" value={origen} onChange={e => setOrigen(e.target.value)} />
            <input type="text" placeholder="Destino (ej: Madrid)" value={destino} onChange={e => setDestino(e.target.value)} />
            <button className="btn-secondary" onClick={calcularRutaViaje} disabled={viajeLoading || !cocheData}>
              {viajeLoading ? 'Calculando...' : 'Calcular Ruta'}
            </button>
          </div>
        )}

        <button className="btn-primary" onClick={handleBuscar} disabled={!modeloSeleccionado || cargandoBusqueda}>
          {cargandoBusqueda ? 'Calculando...' : 'GENERAR PRESUPUESTO'}
        </button>
      </div>

      {cocheData && resultados && (
        <div className="glass-panel results-panel" id={`pdf-content-${panelId}`}>
          <div className="results-header">
            <h2>📊 {cocheData.nombre}</h2>
            <button className="btn-pdf" onClick={handleDownloadPDF} data-html2canvas-ignore>📄 PDF</button>
          </div>

          <div className="etiqueta-badge" style={{backgroundColor: resultados.etiqueta.bg, color: resultados.etiqueta.color, border: `2px solid ${resultados.etiqueta.color}`}}>
            <strong>Etiqueta DGT:</strong> {resultados.etiqueta.label}
          </div>

          <div className="results-grid mini">
            <div className="metric-card"><div className="metric-label">CO2</div><div className="metric-value">{cocheData.emisiones_co2||0}</div></div>
            <div className="metric-card"><div className="metric-label">Consumo</div><div className="metric-value">{cocheData.consumo_l_100km||0} L</div></div>
            <div className="metric-card"><div className="metric-label">Tramo IM</div><div className="metric-value">{resultados.porcentajeIm}%</div></div>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value) => `${value.toLocaleString('es-ES', {maximumFractionDigits:0})} €`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="breakdown">
            <h3>Desglose de Trámites e Impuestos</h3>
            <div className="breakdown-item"><span>Valor Hacienda (Base Imponible)</span> <span>{resultados.valorHacienda.toLocaleString('es-ES')} €</span></div>
            <div className="breakdown-item"><span>Impuesto Matriculación ({resultados.porcentajeIm}%)</span> <span className="text-red">{resultados.importeIm.toLocaleString('es-ES')} €</span></div>
            <div className="breakdown-item"><span>Gastos Fijos (ITV, DGT, Placas, Trad.)</span> <span className="text-orange">{TOTAL_TRAMITES.toLocaleString('es-ES')} €</span></div>
            {resultados.costeViajeGasolina > 0 && (
              <div className="breakdown-item"><span>Viaje ({datosViaje?.distancia}km Gasolina)</span> <span className="text-blue">{resultados.costeViajeGasolina.toLocaleString('es-ES', {maximumFractionDigits:0})} €</span></div>
            )}
            <div className="breakdown-item highlight"><span>Total Gastos Extra de Importación</span> <span>{resultados.totalCosteExtra.toLocaleString('es-ES', {maximumFractionDigits:0})} €</span></div>
          </div>

          <div className="total-box">
            <div className="total-label">Presupuesto Real Coche Puesto en Casa</div>
            <div className="total-value">{resultados.totalPresupuesto.toLocaleString('es-ES', {maximumFractionDigits: 0})} €</div>
            <div style={{fontSize:'0.8rem', opacity:0.7, marginTop:'0.5rem'}}>El Seguro anual costaría aprox: {cocheData.seguro_estimado}</div>
          </div>
        </div>
      )}
    </div>
  );
}
