import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import html2pdf from 'html2pdf.js';

const DEPRECIACION_BOE = { 0: 1.00, 1: 0.84, 2: 0.67, 3: 0.56, 4: 0.47, 5: 0.39, 6: 0.34, 7: 0.28, 8: 0.24, 9: 0.19, 10: 0.17 };
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
  const [loadingModelos, setLoadingModelos] = useState(false);
  
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

  const [mercadoSuizo, setMercadoSuizo] = useState(false);
  const [urlMobileDe, setUrlMobileDe] = useState('');
  const [extrayendo, setExtrayendo] = useState(false);
  
  const [calcularPrestamo, setCalcularPrestamo] = useState(false);
  const [entrada, setEntrada] = useState(5000);
  const [mesesPrestamo, setMesesPrestamo] = useState(60);

  // v6 Seguros
  const [edadConductor, setEdadConductor] = useState(30);
  const [anosCarnet, setAnosCarnet] = useState(10);
  const [seguroBaseDB, setSeguroBaseDB] = useState(null);

  const TIPO_INTERES_ANUAL = 0.075; 

  useEffect(() => {
    if (!marcaSeleccionada) { setModelos([]); setModeloBusqueda(''); setModeloSeleccionado(null); return; }
    async function loadModelos() {
      setLoadingModelos(true);
      const { data } = await supabase.from('modelos').select('*').eq('marca_id', marcaSeleccionada).order('nombre');
      if (data) setModelos(data);
      setLoadingModelos(false);
    }
    loadModelos();
  }, [marcaSeleccionada]);

  async function extraerMobileDe() {
    if (!urlMobileDe) return;
    setExtrayendo(true);
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlMobileDe)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      const html = data.contents;
      const priceMatch = html.match(/(?:EUR|€)\s*([\d\.,]+)/i) || html.match(/([\d\.,]+)\s*(?:EUR|€)/i);
      if (priceMatch) {
        const pStr = priceMatch[1].replace(/\./g, '').replace(/,/g, '.');
        const p = parseFloat(pStr);
        if (!isNaN(p) && p > 1000) setPrecioOrigen(p);
      }
      alert("Comprueba si el Precio Origen se ha rellenado.");
    } catch(e) { alert("Error al extraer URL."); }
    setExtrayendo(false);
  }

  async function handleBuscar() {
    if (!modeloSeleccionado) { alert("Selecciona un modelo."); return; }
    setCargandoBusqueda(true);
    setDatosViaje(null);
    const { data: modData } = await supabase.from('modelos').select('*').eq('id', modeloSeleccionado).single();
    const { data: segData } = await supabase.from('seguros').select('precio_anual').eq('modelo_id', modeloSeleccionado).limit(1);
    
    // Guardamos el precio base del seguro si existe en la BD (sino null)
    let seguroBase = segData?.length > 0 ? parseFloat(segData[0].precio_anual) : null;
    setSeguroBaseDB(seguroBase);
    setCocheData(modData);
    setCargandoBusqueda(false);
  }

  async function calcularRutaViaje() {
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
    } catch(e) {}
    setViajeLoading(false);
  }

  useEffect(() => {
    if (!cocheData || !precioOrigen) return;
    async function calcularTodo() {
      let precioFinalEur = precioOrigen;
      let aduanasEivaSuiza = 0;

      if (mercadoSuizo) {
        try {
          const res = await fetch('https://api.frankfurter.app/latest?from=CHF&to=EUR');
          const rates = await res.json();
          precioFinalEur = precioOrigen * rates.rates.EUR;
        } catch(e) { precioFinalEur = precioOrigen * 1.05; }
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
      
      // Estimación del Seguro v6
      let multiplicadorRiesgo = 1.0;
      if (edadConductor < 25) multiplicadorRiesgo += 0.8;
      else if (edadConductor < 30) multiplicadorRiesgo += 0.3;
      if (anosCarnet < 2) multiplicadorRiesgo += 0.5;
      else if (anosCarnet < 5) multiplicadorRiesgo += 0.2;
      
      // Si la BD no tiene base, estimamos un 2% del precio del coche como base
      const baseReal = seguroBaseDB || (precioFinalEur * 0.02); 
      const seguroEstimadoAnual = baseReal * multiplicadorRiesgo;

      const totalCosteExtra = importeIm + TOTAL_TRAMITES + costeViajeGasolina + aduanasEivaSuiza + seguroEstimadoAnual;
      const totalPresupuesto = precioFinalEur + totalCosteExtra;
      const etiqueta = getEtiquetaDGT(co2, antiguedad);

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
        costeViajeGasolina, totalCosteExtra, totalPresupuesto, etiqueta, cuotaMensual, seguroEstimadoAnual
      });
    }
    calcularTodo();
  }, [cocheData, precioOrigen, antiguedad, datosViaje, calcularViaje, mercadoSuizo, calcularPrestamo, entrada, mesesPrestamo, edadConductor, anosCarnet, seguroBaseDB]);

  async function handleGuardarGaraje() {
    if (!user) return alert("Debes iniciar sesión");
    const { error } = await supabase.from('garaje').insert([{
      user_id: user.id, coche_nombre: cocheData.nombre, presupuesto_total: resultados.totalPresupuesto, datos_json: resultados
    }]);
    if (error) alert(error.message); else alert("Coche guardado en Mi Garaje!");
  }

  const handleDownloadPDF = () => {
    const element = document.getElementById(`pdf-content-${panelId}`);
    html2pdf().set({ margin: 10, filename: 'Presupuesto.pdf' }).from(element).save();
  };

  const chartData = resultados ? [
    { name: 'Coche', value: resultados.precioFinalEur, color: '#94a3b8' },
    { name: 'I. Matric.', value: resultados.importeIm, color: '#ef4444' },
    { name: 'Aduanas', value: resultados.aduanasEivaSuiza, color: '#ec4899' },
    { name: 'Trámites', value: TOTAL_TRAMITES, color: '#f59e0b' },
    { name: 'Viaje', value: resultados.costeViajeGasolina, color: '#3b82f6' },
    { name: 'Seguro', value: resultados.seguroEstimadoAnual, color: '#8b5cf6' }
  ].filter(i => i.value > 0) : [];

  return (
    <div className="panel-wrapper">
      <div className="glass-panel search-panel">
        <h2>🔍 Configurar Vehículo {panelId}</h2>
        
        <div className="travel-box" style={{marginBottom: '1rem'}}>
          <label style={{color:'white'}}>AutoScout/Mobile.de</label>
          <div style={{display:'flex', gap:'5px'}}>
            <input type="text" placeholder="Pegar URL..." value={urlMobileDe} onChange={e=>setUrlMobileDe(e.target.value)} />
            <button className="btn-secondary" style={{width:'auto', padding:'0 1rem', marginTop:0}} onClick={extraerMobileDe}>{extrayendo ? '...' : 'Extraer'}</button>
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
        
        {/* Panel Seguros Demográficos */}
        <div className="form-row" style={{marginTop:'0.5rem'}}>
          <div className="form-group">
            <label>Edad Conductor</label>
            <input type="number" min="18" value={edadConductor} onChange={e => setEdadConductor(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Años de Carnet</label>
            <input type="number" min="0" value={anosCarnet} onChange={e => setAnosCarnet(Number(e.target.value))} />
          </div>
        </div>

        <div className="extra-modules" style={{marginTop:'1rem', display:'flex', flexDirection:'column', gap:'0.5rem'}}>
          <label style={{display:'flex', gap:'10px', color:'white', cursor:'pointer'}}><input type="checkbox" checked={mercadoSuizo} onChange={e=>setMercadoSuizo(e.target.checked)} style={{width:'auto'}} /> Suiza (Aduanas y Divisa)</label>
          <label style={{display:'flex', gap:'10px', color:'white', cursor:'pointer'}}><input type="checkbox" checked={calcularViaje} onChange={e=>setCalcularViaje(e.target.checked)} style={{width:'auto'}} /> Traer conduciendo a España</label>
          {calcularViaje && (
            <div className="travel-box">
              <input type="text" placeholder="Origen" value={origen} onChange={e=>setOrigen(e.target.value)} />
              <input type="text" placeholder="Destino" value={destino} onChange={e=>setDestino(e.target.value)} />
              <button className="btn-secondary" onClick={calcularRutaViaje} disabled={viajeLoading || !cocheData}>{viajeLoading ? '...' : 'Calcular Ruta'}</button>
            </div>
          )}
          <label style={{display:'flex', gap:'10px', color:'white', cursor:'pointer'}}><input type="checkbox" checked={calcularPrestamo} onChange={e=>setCalcularPrestamo(e.target.checked)} style={{width:'auto'}} /> Financiar</label>
          {calcularPrestamo && (
            <div className="travel-box">
              <input type="number" placeholder="Entrada (€)" value={entrada} onChange={e=>setEntrada(Number(e.target.value))} />
              <input type="number" placeholder="Meses (ej: 60)" value={mesesPrestamo} onChange={e=>setMesesPrestamo(Number(e.target.value))} />
            </div>
          )}
        </div>

        <button className="btn-primary" onClick={handleBuscar} disabled={!modeloSeleccionado || cargandoBusqueda}>GENERAR PRESUPUESTO</button>
      </div>

      {cocheData && resultados && (
        <div className="glass-panel results-panel" id={`pdf-content-${panelId}`}>
          <div className="results-header">
            <h2>📊 {cocheData.nombre}</h2>
            <div style={{display:'flex', gap:'5px'}}>
              {user && <button className="btn-pdf" style={{background:'#10b981'}} onClick={handleGuardarGaraje} data-html2canvas-ignore>❤️</button>}
              <button className="btn-pdf" onClick={handleDownloadPDF} data-html2canvas-ignore>📄 PDF</button>
            </div>
          </div>

          <div className="etiqueta-badge" style={{backgroundColor: resultados.etiqueta.bg, color: resultados.etiqueta.color, border: `2px solid ${resultados.etiqueta.color}`}}>
            <strong>DGT:</strong> {resultados.etiqueta.label}
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value">{chartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={v=>`${v.toLocaleString('es-ES', {maximumFractionDigits:0})} €`}/><Legend /></PieChart>
            </ResponsiveContainer>
          </div>

          <div className="breakdown">
            <div className="breakdown-item"><span>Coche Origen</span> <span>{resultados.precioFinalEur.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>
            {mercadoSuizo && <div className="breakdown-item"><span>Aduanas + IVA Extra</span> <span style={{color:'#ec4899'}}>{resultados.aduanasEivaSuiza.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>}
            <div className="breakdown-item"><span>I. Matriculación ({resultados.porcentajeIm}%)</span> <span className="text-red">{resultados.importeIm.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>
            <div className="breakdown-item"><span>Gastos Fijos (ITV, DGT, Placas)</span> <span className="text-orange">{TOTAL_TRAMITES.toLocaleString('es-ES')} €</span></div>
            {resultados.costeViajeGasolina > 0 && <div className="breakdown-item"><span>Viaje Gasolina</span> <span className="text-blue">{resultados.costeViajeGasolina.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>}
            <div className="breakdown-item"><span>Seguro Anual Estimado</span> <span style={{color:'#8b5cf6', fontWeight:'bold'}}>{resultados.seguroEstimadoAnual.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>
            <div className="breakdown-item highlight"><span>Total Gastos Extra</span> <span>{resultados.totalCosteExtra.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span></div>
          </div>

          <div className="total-box">
            <div className="total-label">Presupuesto Real Coche Puesto en Casa</div>
            <div className="total-value">{resultados.totalPresupuesto.toLocaleString('es-ES', {maximumFractionDigits: 0})} €</div>
            {calcularPrestamo && (
              <div style={{marginTop:'1rem', padding:'0.5rem', background:'rgba(255,255,255,0.1)', borderRadius:'8px'}}>
                <div style={{fontSize:'0.9rem'}}>Cuota ({mesesPrestamo} meses al {TIPO_INTERES_ANUAL*100}% TAE)</div>
                <div style={{fontSize:'1.5rem', fontWeight:'bold', color:'white'}}>{resultados.cuotaMensual.toLocaleString('es-ES', {maximumFractionDigits:2})} € / mes</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
