import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import html2pdf from 'html2pdf.js';

const DEPRECIACION_BOE = {
  0: 1.00, 1: 0.84, 2: 0.67, 3: 0.56, 4: 0.47,
  5: 0.39, 6: 0.34, 7: 0.28, 8: 0.24, 9: 0.19, 10: 0.17
};

const COSTES_FIJOS = { itv: 150, placas: 30, traduccion: 80, tasaDgt: 99.77 };
const TOTAL_TRAMITES = COSTES_FIJOS.itv + COSTES_FIJOS.placas + COSTES_FIJOS.traduccion + COSTES_FIJOS.tasaDgt;
const PRECIO_GASOLINA = 1.60;

function getEtiquetaDGT(co2, antiguedad) {
  if (co2 === 0) return { label: 'CERO', color: '#005a9e', bg: '#e0f2fe' };
  if (antiguedad < 8) return { label: 'C', color: '#166534', bg: '#dcfce7' };
  if (antiguedad >= 8 && antiguedad < 18) return { label: 'B', color: '#854d0e', bg: '#fef08a' };
  return { label: 'SIN ETIQUETA', color: '#7f1d1d', bg: '#fecaca' };
}

export default function CarPanel({ panelId, marcas, user }) {
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

  // v5 Features
  const [mercadoSuizo, setMercadoSuizo] = useState(false);
  const [urlMobileDe, setUrlMobileDe] = useState('');
  const [extrayendo, setExtrayendo] = useState(false);
  
  const [calcularPrestamo, setCalcularPrestamo] = useState(false);
  const [entrada, setEntrada] = useState(5000);
  const [mesesPrestamo, setMesesPrestamo] = useState(60);

  const TIPO_INTERES_ANUAL = 0.075; // 7.5% TAE por defecto

  useEffect(() => {
    if (!marcaSeleccionada) {
      setModelos([]); setModeloBusqueda(''); setModeloSeleccionado(null);
      return;
    }
    async function loadModelos() {
      setLoadingModelos(true);
      const { data } = await supabase.from('modelos').select('*').eq('marca_id', marcaSeleccionada).order('nombre');
      if (data) setModelos(data);
      setLoadingModelos(false);
    }
    loadModelos();
  }, [marcaSeleccionada]);

  // Scraper simulado / Cors proxy para URLs
  async function extraerMobileDe() {
    if (!urlMobileDe) return;
    setExtrayendo(true);
    try {
      // Usar proxy CORS gratuito para extraer HTML
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlMobileDe)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      const html = data.contents;
      
      // Buscar precio genérico en HTML (Regex simple para buscar € XX.XXX)
      const priceMatch = html.match(/(?:EUR|€)\s*([\d\.,]+)/i) || html.match(/([\d\.,]+)\s*(?:EUR|€)/i);
      if (priceMatch) {
        const pStr = priceMatch[1].replace(/\./g, '').replace(/,/g, '.');
        const p = parseFloat(pStr);
        if (!isNaN(p) && p > 1000) setPrecioOrigen(p);
      }
      alert("Extracción completada. Comprueba que el precio Origen se ha rellenado correctamente (CORS proxy puede ser inestable según el anuncio).");
    } catch(e) {
      alert("No se pudo extraer la URL. Mobile.de podría estar bloqueando el proxy.");
    }
    setExtrayendo(false);
  }

  async function handleBuscar() {
    if (!modeloSeleccionado) { alert("Selecciona un modelo."); return; }
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

  async function calcularRutaViaje() {
    // ... logic remains identical
    if (!origen || !destino || !cocheData) return;
    setViajeLoading(true);
    try {
      const resOrig = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(origen)}`);
      const dOrig = await resOrig.json();
      const resDest = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destino)}`);
      const dDest = await resDest.json();
      if (dOrig.length > 0 && dDest.length > 0) {
        const resRuta = await fetch(`https://router.project-osrm.org/route/v1/driving/${dOrig[0].lon},${dOrig[0].lat};${dDest[0].lon},${dDest[0].lat}?overview=false`);
        const dataRuta = await resRuta.json();
        if (dataRuta.code === 'Ok') {
          const distKm = dataRuta.routes[0].distance / 1000;
          setDatosViaje({ distancia: Math.round(distKm), costeGasolina: (distKm/100)*(cocheData.consumo_l_100km||0)*PRECIO_GASOLINA });
        }
      }
    } catch(e) { alert("Error al calcular ruta."); }
    setViajeLoading(false);
  }

  useEffect(() => {
    if (!cocheData || !precioOrigen) return;
    
    async function calcularTodo() {
      let precioFinalEur = precioOrigen;
      let aduanasEivaSuiza = 0;

      // Conversión Suiza CHF a EUR y Aduanas
      if (mercadoSuizo) {
        try {
          const res = await fetch('https://api.frankfurter.app/latest?from=CHF&to=EUR');
          const rates = await res.json();
          precioFinalEur = precioOrigen * rates.rates.EUR;
        } catch(e) { 
          precioFinalEur = precioOrigen * 1.05; // fallback rate
        }
        // 10% Arancel + 21% IVA español sobre el importe + arancel
        const arancel = precioFinalEur * 0.10;
        const baseIva = precioFinalEur + arancel;
        const iva = baseIva * 0.21;
        aduanasEivaSuiza = arancel + iva;
      }

      const co2 = cocheData.emisiones_co2 || 0;
      let porcentajeIm = 0;
      if (co2 > 120 && co2 <= 159) porcentajeIm = 4.75;
      else if (co2 >= 160 && co2 <= 199) porcentajeIm = 9.75;
      else if (co2 >= 200) porcentajeIm = 14.75;

      const depreciacion = DEPRECIACION_BOE[antiguedad > 10 ? 10 : antiguedad];
      const valorHacienda = precioFinalEur * depreciacion;
      const importeIm = valorHacienda * (porcentajeIm / 100);
      
      const costeViajeGasolina = (calcularViaje && datosViaje) ? datosViaje.costeGasolina : 0;
      const totalCosteExtra = importeIm + TOTAL_TRAMITES + costeViajeGasolina + aduanasEivaSuiza;
      const totalPresupuesto = precioFinalEur + totalCosteExtra;
      const etiqueta = getEtiquetaDGT(co2, antiguedad);

      // Calculadora Prestamo
      let cuotaMensual = 0;
      if (calcularPrestamo) {
        const capitalPrestar = totalPresupuesto - entrada;
        if (capitalPrestar > 0) {
          const rMensual = TIPO_INTERES_ANUAL / 12;
          cuotaMensual = (capitalPrestar * rMensual * Math.pow(1 + rMensual, mesesPrestamo)) / (Math.pow(1 + rMensual, mesesPrestamo) - 1);
        }
      }
      
      setResultados({
        precioFinalEur, aduanasEivaSuiza, valorHacienda, porcentajeIm, importeIm, 
        costeViajeGasolina, totalCosteExtra, totalPresupuesto, etiqueta, cuotaMensual
      });
    }
    calcularTodo();
  }, [cocheData, precioOrigen, antiguedad, datosViaje, calcularViaje, mercadoSuizo, calcularPrestamo, entrada, mesesPrestamo]);

  async function handleGuardarGaraje() {
    if (!user) return alert("Debes iniciar sesión para guardar en Mi Garaje");
    const { error } = await supabase.from('garaje').insert([{
      user_id: user.id,
      coche_nombre: cocheData.nombre,
      presupuesto_total: resultados.totalPresupuesto,
      datos_json: resultados
    }]);
    if (error) alert(error.message);
    else alert("¡Coche guardado en tu garaje!");
  }

  const handleDownloadPDF = () => {
    const element = document.getElementById(`pdf-content-${panelId}`);
    html2pdf().set({ margin: 10, filename: 'Presupuesto_Importacion.pdf' }).from(element).save();
  };

  const chartData = resultados ? [
    { name: 'Coche Base', value: resultados.precioFinalEur, color: '#94a3b8' },
    { name: 'Imp. Matric.', value: resultados.importeIm, color: '#ef4444' },
    { name: 'Aduanas/IVA', value: resultados.aduanasEivaSuiza, color: '#ec4899' },
    { name: 'Trámites', value: TOTAL_TRAMITES, color: '#f59e0b' },
    { name: 'Viaje (Gasolina)', value: resultados.costeViajeGasolina, color: '#3b82f6' }
  ].filter(i => i.value > 0) : [];

  return (
    <div className="panel-wrapper">
      <div className="glass-panel search-panel">
        <h2>🔍 Configurar Vehículo {panelId}</h2>
        
        {/* Scraper Tool */}
        <div className="travel-box" style={{marginBottom: '1rem'}}>
          <label style={{color:'white'}}>Enlace Automático (AutoScout/Mobile.de)</label>
          <div style={{display:'flex', gap:'5px'}}>
            <input type="text" placeholder="Pegar enlace URL aquí..." value={urlMobileDe} onChange={e=>setUrlMobileDe(e.target.value)} />
            <button className="btn-secondary" style={{width:'auto', padding:'0 1rem', marginTop:0}} onClick={extraerMobileDe} disabled={extrayendo}>{extrayendo ? '...' : 'Extraer'}</button>
          </div>
        </div>

        <div className="form-group">
          <label>Marca</label>
          <input type="text" list={`marcas-list-${panelId}`} value={marcaBusqueda} onChange={e => {
            setMarcaBusqueda(e.target.value); const m = marcas.find(x => x.nombre === e.target.value); setMarcaSeleccionada(m ? m.id : null);
          }} />
          <datalist id={`marcas-list-${panelId}`}>{marcas.map(m => <option key={m.id} value={m.nombre} />)}</datalist>
        </div>
        <div className="form-group">
          <label>Modelo</label>
          <input type="text" list={`modelos-list-${panelId}`} value={modeloBusqueda} disabled={!marcaSeleccionada || loadingModelos} onChange={e => {
            setModeloBusqueda(e.target.value); const m = modelos.find(x => x.nombre === e.target.value); setModeloSeleccionado(m ? m.id : null);
          }} />
          <datalist id={`modelos-list-${panelId}`}>{modelos.map(m => <option key={m.id} value={m.nombre} />)}</datalist>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Precio Origen {mercadoSuizo ? '(CHF)' : '(€)'}</label>
            <input type="number" value={precioOrigen} onChange={e => setPrecioOrigen(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Antigüedad (Años)</label>
            <input type="number" min="0" value={antiguedad} onChange={e => setAntiguedad(Number(e.target.value))} />
          </div>
        </div>

        {/* Módulos Extra */}
        <div className="extra-modules" style={{marginTop:'1rem', display:'flex', flexDirection:'column', gap:'0.5rem'}}>
          <label style={{display:'flex', gap:'10px', color:'white', cursor:'pointer'}}><input type="checkbox" checked={mercadoSuizo} onChange={e=>setMercadoSuizo(e.target.checked)} style={{width:'auto'}} /> Importado de Suiza (Aplica Aduanas y Divisa)</label>
          <label style={{display:'flex', gap:'10px', color:'white', cursor:'pointer'}}><input type="checkbox" checked={calcularViaje} onChange={e=>setCalcularViaje(e.target.checked)} style={{width:'auto'}} /> Traer conduciendo a España</label>
          {calcularViaje && (
            <div className="travel-box">
              <input type="text" placeholder="Origen" value={origen} onChange={e=>setOrigen(e.target.value)} />
              <input type="text" placeholder="Destino" value={destino} onChange={e=>setDestino(e.target.value)} />
              <button className="btn-secondary" onClick={calcularRutaViaje} disabled={viajeLoading || !cocheData}>{viajeLoading ? 'Calculando...' : 'Calcular Ruta'}</button>
            </div>
          )}
          
          <label style={{display:'flex', gap:'10px', color:'white', cursor:'pointer'}}><input type="checkbox" checked={calcularPrestamo} onChange={e=>setCalcularPrestamo(e.target.checked)} style={{width:'auto'}} /> Financiar Compra + Gastos</label>
          {calcularPrestamo && (
            <div className="travel-box">
              <label>Entrada Aportada (€)</label>
              <input type="number" value={entrada} onChange={e=>setEntrada(Number(e.target.value))} />
              <label>Meses (ej: 60 = 5 años)</label>
              <input type="number" value={mesesPrestamo} onChange={e=>setMesesPrestamo(Number(e.target.value))} />
            </div>
          )}
        </div>

        <button className="btn-primary" onClick={handleBuscar} disabled={!modeloSeleccionado || cargandoBusqueda}>
          {cargandoBusqueda ? 'Calculando...' : 'GENERAR PRESUPUESTO'}
        </button>
      </div>

      {cocheData && resultados && (
        <div className="glass-panel results-panel" id={`pdf-content-${panelId}`}>
          <div className="results-header">
            <h2>📊 {cocheData.nombre}</h2>
            <div style={{display:'flex', gap:'5px'}}>
              {user && <button className="btn-pdf" style={{background:'#10b981'}} onClick={handleGuardarGaraje} data-html2canvas-ignore>❤️ Guardar</button>}
              <button className="btn-pdf" onClick={handleDownloadPDF} data-html2canvas-ignore>📄 PDF</button>
            </div>
          </div>

          <div className="etiqueta-badge" style={{backgroundColor: resultados.etiqueta.bg, color: resultados.etiqueta.color, border: `2px solid ${resultados.etiqueta.color}`}}>
            <strong>DGT:</strong> {resultados.etiqueta.label}
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value">{chartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={v=>`${v.toLocaleString()} €`}/><Legend /></PieChart>
            </ResponsiveContainer>
          </div>

          <div className="breakdown">
            <div className="breakdown-item"><span>Coche Origen {mercadoSuizo && '(Convertido CHF->EUR)'}</span> <span>{resultados.precioFinalEur.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>
            {mercadoSuizo && <div className="breakdown-item"><span>Aduanas + IVA Extra (Suiza)</span> <span style={{color:'#ec4899'}}>{resultados.aduanasEivaSuiza.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>}
            <div className="breakdown-item"><span>Impuesto Matriculación ({resultados.porcentajeIm}%)</span> <span className="text-red">{resultados.importeIm.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>
            <div className="breakdown-item"><span>Gastos Fijos (ITV, DGT, Placas)</span> <span className="text-orange">{TOTAL_TRAMITES.toLocaleString('es-ES')} €</span></div>
            {resultados.costeViajeGasolina > 0 && <div className="breakdown-item"><span>Viaje Gasolina</span> <span className="text-blue">{resultados.costeViajeGasolina.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>}
            <div className="breakdown-item highlight"><span>Total Gastos Extra de Importación</span> <span>{resultados.totalCosteExtra.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>
          </div>

          <div className="total-box">
            <div className="total-label">Presupuesto Real Coche Puesto en Casa</div>
            <div className="total-value">{resultados.totalPresupuesto.toLocaleString('es-ES', {maximumFractionDigits: 0})} €</div>
            {calcularPrestamo && (
              <div style={{marginTop:'1rem', padding:'0.5rem', background:'rgba(255,255,255,0.1)', borderRadius:'8px'}}>
                <div style={{fontSize:'0.9rem'}}>Cuota Financiación ({mesesPrestamo} meses al {TIPO_INTERES_ANUAL*100}% TAE)</div>
                <div style={{fontSize:'1.5rem', fontWeight:'bold', color:'white'}}>{resultados.cuotaMensual.toLocaleString('es-ES', {maximumFractionDigits:2})} € / mes</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
