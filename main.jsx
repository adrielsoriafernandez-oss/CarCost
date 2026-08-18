import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import html2pdf from 'html2pdf.js';

const DEPRECIACION_BOE = { 0: 1.00, 1: 0.84, 2: 0.67, 3: 0.56, 4: 0.47, 5: 0.39, 6: 0.34, 7: 0.28, 8: 0.24, 9: 0.19, 10: 0.17 };
const DEPRECIACION_MERCADO = { 0: 1.00, 1: 0.82, 2: 0.74, 3: 0.66, 4: 0.58, 5: 0.51, 6: 0.45, 7: 0.40, 8: 0.36, 9: 0.32, 10: 0.28 };
const COSTES_FIJOS = { itv: 150, placas: 30, traduccion: 80, tasaDgt: 99.77 };
const TOTAL_TRAMITES = COSTES_FIJOS.itv + COSTES_FIJOS.placas + COSTES_FIJOS.traduccion + COSTES_FIJOS.tasaDgt;
const PRECIO_GASOLINA = 1.60;

const ITP_CCAA = {
  'Andalucía': 0.08, 'Aragón': 0.04, 'Asturias': 0.08, 'Baleares': 0.08,
  'Canarias': 0.055, 'Cantabria': 0.08, 'Castilla y León': 0.08, 'Castilla-La Mancha': 0.06,
  'Cataluña': 0.05, 'Ceuta': 0.04, 'Comunidad Valenciana': 0.08, 'Extremadura': 0.06,
  'Galicia': 0.08, 'Madrid': 0.04, 'Melilla': 0.04, 'Murcia': 0.08, 'Navarra': 0.04,
  'País Vasco': 0.04, 'La Rioja': 0.04
};

const MARCAS_PREMIUM = ['audi', 'bmw', 'mercedes', 'mercedes-benz', 'porsche', 'lexus', 'volvo', 'land rover', 'jaguar'];

// SVGs
const DownloadIcon = () => (<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>);
const BookmarkIcon = () => (<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>);

function getEtiquetaDGT(co2, antiguedad) {
  if (co2 === 0) return { label: 'CERO', color: '#005a9e', bg: '#e0f2fe', border: '#bae6fd' };
  if (antiguedad < 8) return { label: 'C', color: '#166534', bg: '#dcfce7', border: '#bbf7d0' };
  if (antiguedad >= 8 && antiguedad < 18) return { label: 'B', color: '#854d0e', bg: '#fef08a', border: '#fde047' };
  return { label: 'SIN ETIQUETA', color: '#7f1d1d', bg: '#fecaca', border: '#f87171' };
}

export default function CarPanel({ panelId, marcas, user, isComparisonMode }) {
  const [modelos, setModelos] = useState([]);
  const [marcaBusqueda, setMarcaBusqueda] = useState('');
  const [marcaSeleccionada, setMarcaSeleccionada] = useState(null);
  const [modeloBusqueda, setModeloBusqueda] = useState('');
  const [modeloSeleccionado, setModeloSeleccionado] = useState(null);
  const [loadingModelos, setLoadingModelos] = useState(false);
  
  const [cocheData, setCocheData] = useState(null);
  const [cargandoBusqueda, setCargandoBusqueda] = useState(false);
  
  const [precioOrigen, setPrecioOrigen] = useState('');
  const [fechaMatriculacion, setFechaMatriculacion] = useState('');
  const [kilometros, setKilometros] = useState('');
  const [combustible, setCombustible] = useState('gasolina');
  
  const [tipoVendedor, setTipoVendedor] = useState('concesionario');
  const [comunidadAutonoma, setComunidadAutonoma] = useState('Madrid');
  
  const [resultados, setResultados] = useState(null);
  
  const [tipoTransporte, setTipoTransporte] = useState('ninguno'); // ninguno, conduciendo, grua
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [viajeLoading, setViajeLoading] = useState(false);
  const [datosViaje, setDatosViaje] = useState(null);

  const [mercadoSuizo, setMercadoSuizo] = useState(false);
  const [calcularPrestamo, setCalcularPrestamo] = useState(false);
  const [entrada, setEntrada] = useState('');
  const [mesesPrestamo, setMesesPrestamo] = useState('');

  const [edadConductor, setEdadConductor] = useState('');
  const [anosCarnet, setAnosCarnet] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
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

  async function handleBuscar() {
    if (!modeloSeleccionado) { alert("Selecciona un modelo."); return; }
    setCargandoBusqueda(true);
    setDatosViaje(null);
    const { data: modData } = await supabase.from('modelos').select('*').eq('id', modeloSeleccionado).single();
    const { data: segData } = await supabase.from('seguros').select('precio_anual').eq('modelo_id', modeloSeleccionado).limit(1);
    
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
    if (!cocheData || !precioOrigen || !fechaMatriculacion || kilometros === '') return;
    
    // Calcular antigüedad real
    const diffTime = Math.abs(new Date() - new Date(fechaMatriculacion));
    const antiguedad = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25)) || 0;
    const ageKey = antiguedad > 10 ? 10 : antiguedad;

    async function calcularTodo() {
      let precioFinalEur = Number(precioOrigen) || 0;
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

      // Impuesto Matriculación y Valor BOE
      const co2 = cocheData.emisiones_co2 || 0;
      let porcentajeIm = 0;
      if (co2 > 120 && co2 <= 159) porcentajeIm = 4.75;
      else if (co2 >= 160 && co2 <= 199) porcentajeIm = 9.75;
      else if (co2 >= 200) porcentajeIm = 14.75;
      
      const factorMercado = DEPRECIACION_MERCADO[ageKey];
      const precioNuevoEstimado = precioFinalEur / factorMercado;
      
      // Si la BD tiene el valor BOE real, lo usa. Si no, usa nuestra estimación (Idea 1)
      const precioNuevoBOE = cocheData.precio_nuevo_boe || precioNuevoEstimado; 
      
      const depreciacionBOE = DEPRECIACION_BOE[ageKey];
      const valorHacienda = precioNuevoBOE * depreciacionBOE;
      const importeIm = valorHacienda * (porcentajeIm / 100);

      // Impuesto Transmisiones Patrimoniales (ITP) (Idea 2)
      let importeITP = 0;
      if (tipoVendedor === 'particular') {
        const porcentajeITP = ITP_CCAA[comunidadAutonoma] || 0.04;
        importeITP = valorHacienda * porcentajeITP;
      }
      
      // Transporte (Ideas 4 y 8)
      let costeTransporteTotal = 0;
      let viajeDesglose = { gasolina: 0, extra: 0, grua: 0 };
      
      if (tipoTransporte === 'conduciendo') {
        viajeDesglose.gasolina = datosViaje ? datosViaje.costeGasolina : 0;
        viajeDesglose.extra = 380; // Vuelo 120 + Hotel 80 + Placas Tránsito 180
        costeTransporteTotal = viajeDesglose.gasolina + viajeDesglose.extra;
      } else if (tipoTransporte === 'grua') {
        viajeDesglose.grua = datosViaje ? 200 + (datosViaje.distancia * 0.85) : 0;
        costeTransporteTotal = viajeDesglose.grua;
      }
      
      // Seguro por CP (Idea 5)
      let multiplicadorRiesgo = 1.0;
      if (edadConductor < 25) multiplicadorRiesgo += 0.8;
      else if (edadConductor < 30) multiplicadorRiesgo += 0.3;
      if (anosCarnet < 2) multiplicadorRiesgo += 0.5;
      else if (anosCarnet < 5) multiplicadorRiesgo += 0.2;
      
      const cpPrefix = codigoPostal.substring(0, 2);
      if (['28', '08', '46', '41', '29', '48'].includes(cpPrefix)) {
        multiplicadorRiesgo += 0.15; // Zonas urbanas de alta siniestralidad
      }
      
      const baseReal = seguroBaseDB || (precioFinalEur * 0.02); 
      const seguroEstimadoAnual = baseReal * multiplicadorRiesgo;

      const totalCosteExtra = importeIm + importeITP + TOTAL_TRAMITES + costeTransporteTotal + aduanasEivaSuiza + seguroEstimadoAnual;
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

      // Algoritmo Valor Mercado España Avanzado (Idea 3)
      let primaMercado = 1.10; // Base premium
      if (MARCAS_PREMIUM.some(m => marcaBusqueda.toLowerCase().includes(m))) primaMercado += 0.10; // +10% premium brand
      if (combustible === 'diesel') primaMercado -= 0.05; // -5% penalización diésel ZBE
      
      let precioEspanaBase = precioNuevoBOE * factorMercado * primaMercado; 

      const kilometrosIdeales = antiguedad * 15000;
      const diferenciaKm = kilometros - kilometrosIdeales;
      const tramos10k = diferenciaKm / 10000;
      let ajusteKm = 1.0;
      if (tramos10k > 0) {
        ajusteKm = 1 - (tramos10k * 0.015);
      } else if (tramos10k < 0) {
        ajusteKm = 1 + (Math.abs(tramos10k) * 0.01);
      }

      const valorEstimadoEspana = precioEspanaBase * ajusteKm;
      const ahorroEstimado = valorEstimadoEspana - totalPresupuesto;
      
      setResultados({
        precioFinalEur, aduanasEivaSuiza, valorHacienda, porcentajeIm, importeIm, importeITP,
        costeTransporteTotal, viajeDesglose, totalCosteExtra, totalPresupuesto, etiqueta, cuotaMensual, seguroEstimadoAnual,
        valorEstimadoEspana, ahorroEstimado
      });
    }
    calcularTodo();
  }, [cocheData, precioOrigen, fechaMatriculacion, kilometros, datosViaje, tipoTransporte, mercadoSuizo, calcularPrestamo, entrada, mesesPrestamo, edadConductor, anosCarnet, seguroBaseDB, tipoVendedor, comunidadAutonoma, codigoPostal, combustible, marcaBusqueda]);

  async function handleGuardarGaraje() {
    if (!user) return alert("Debes iniciar sesión");
    const { error } = await supabase.from('garaje').insert([{
      user_id: user.id, coche_nombre: cocheData.nombre, presupuesto_total: resultados.totalPresupuesto, datos_json: resultados
    }]);
    if (error) alert(error.message); else alert("Coche guardado en Mi Garaje");
  }

  const handleDownloadPDF = () => {
    const element = document.getElementById(`pdf-content-${panelId}`);
    html2pdf().set({ margin: 10, filename: 'Resumen_Importacion.pdf' }).from(element).save();
  };

  return (
    <div className={isComparisonMode ? 'stacked-layout' : 'split-layout'}>
      
      {/* Formulario / Inputs */}
      <div>
        <div className="form-section">
          <span className="eyebrow">Vehículo y Adquisición</span>
          <div className="form-grid">
            <div className="form-group">
              <label>Marca</label>
              <input type="text" list={`marcas-list-${panelId}`} value={marcaBusqueda} placeholder="Ej. Audi" onChange={e => {
                setMarcaBusqueda(e.target.value); const m = marcas.find(x => x.nombre === e.target.value); setMarcaSeleccionada(m ? m.id : null);
              }} />
              <datalist id={`marcas-list-${panelId}`}>{marcas.map(m => <option key={m.id} value={m.nombre} />)}</datalist>
            </div>
            <div className="form-group">
              <label>Modelo</label>
              <input type="text" list={`modelos-list-${panelId}`} value={modeloBusqueda} placeholder="Ej. A4 Avant" disabled={!marcaSeleccionada || loadingModelos} onChange={e => {
                setModeloBusqueda(e.target.value); const m = modelos.find(x => x.nombre === e.target.value); setModeloSeleccionado(m ? m.id : null);
              }} />
              <datalist id={`modelos-list-${panelId}`}>{modelos.map(m => <option key={m.id} value={m.nombre} />)}</datalist>
            </div>
            <div className="form-group">
              <label>Combustible</label>
              <select value={combustible} onChange={e => setCombustible(e.target.value)}>
                <option value="gasolina">Gasolina</option>
                <option value="diesel">Diésel</option>
                <option value="hibrido">Híbrido</option>
                <option value="electrico">Eléctrico</option>
              </select>
            </div>
            <div className="form-group">
              <label>Precio de origen {mercadoSuizo ? '(CHF)' : '(€)'}</label>
              <input type="number" value={precioOrigen} placeholder="Ej: 35000" onChange={e => setPrecioOrigen(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Fecha de matriculación</label>
              <input type="date" value={fechaMatriculacion} onChange={e => setFechaMatriculacion(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Kilómetros</label>
              <input type="number" min="0" value={kilometros} placeholder="Ej: 80000" onChange={e => setKilometros(e.target.value)} />
            </div>
            <div className="form-group" style={{gridColumn: '1 / -1'}}>
              <label>Tipo de vendedor en origen</label>
              <select value={tipoVendedor} onChange={e => setTipoVendedor(e.target.value)}>
                <option value="concesionario">Concesionario (IVA Incluido)</option>
                <option value="particular">Vendedor Particular (Sujeto a ITP)</option>
              </select>
            </div>
            {tipoVendedor === 'particular' && (
              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label>Comunidad Autónoma (Para cálculo ITP)</label>
                <select value={comunidadAutonoma} onChange={e => setComunidadAutonoma(e.target.value)}>
                  {Object.keys(ITP_CCAA).map(ccaa => (
                    <option key={ccaa} value={ccaa}>{ccaa} ({(ITP_CCAA[ccaa]*100).toFixed(1)}%)</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="form-section">
          <span className="eyebrow">Perfil de conductor y Seguro</span>
          <div className="form-grid">
            <div className="form-group">
              <label>Edad</label>
              <input type="number" min="18" value={edadConductor} placeholder="Ej: 32" onChange={e => setEdadConductor(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Años de carnet</label>
              <input type="number" min="0" value={anosCarnet} placeholder="Ej: 10" onChange={e => setAnosCarnet(e.target.value)} />
            </div>
            <div className="form-group" style={{gridColumn: '1 / -1'}}>
              <label>Código Postal (Para estimación de siniestralidad)</label>
              <input type="text" value={codigoPostal} placeholder="Ej: 28001" maxLength="5" onChange={e => setCodigoPostal(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <span className="eyebrow">Logística y Opciones Extras</span>
          <div style={{display:'flex', flexDirection:'column', gap:'var(--space-3)'}}>
            
            <label className="checkbox-group">
              <input type="checkbox" checked={mercadoSuizo} onChange={e=>setMercadoSuizo(e.target.checked)} />
              <div className="checkbox-content">
                <span className="checkbox-label">Importación desde Suiza</span>
                <span className="checkbox-desc">Aplica cálculo de aranceles (10%) e IVA (21%) extra comunitarios.</span>
              </div>
            </label>

            <div style={{display:'flex', flexDirection:'column'}}>
              <label className="checkbox-group" style={tipoTransporte !== 'ninguno' ? {borderBottomLeftRadius:0, borderBottomRightRadius:0, borderBottom:'none'} : {}}>
                <select value={tipoTransporte} onChange={e => setTipoTransporte(e.target.value)} style={{marginRight: 'var(--space-2)', width: 'auto'}}>
                  <option value="ninguno">Sin transporte (Gestionado por mí)</option>
                  <option value="conduciendo">Traer conduciendo (Viaje personal)</option>
                  <option value="grua">Transporte en camión grúa</option>
                </select>
                <div className="checkbox-content">
                  <span className="checkbox-label">Logística internacional</span>
                </div>
              </label>
              {tipoTransporte !== 'ninguno' && (
                <div className="nested-form">
                  <input type="text" placeholder="Ciudad de origen (Ej. Múnich)" value={origen} onChange={e=>setOrigen(e.target.value)} />
                  <input type="text" placeholder="Ciudad de destino (Ej. Madrid)" value={destino} onChange={e=>setDestino(e.target.value)} />
                  <button className="btn-secondary" style={{alignSelf:'flex-start'}} onClick={calcularRutaViaje} disabled={viajeLoading || !cocheData}>
                    {viajeLoading ? 'Calculando ruta...' : 'Calcular coste logística'}
                  </button>
                </div>
              )}
            </div>

            <div style={{display:'flex', flexDirection:'column'}}>
              <label className="checkbox-group" style={calcularPrestamo ? {borderBottomLeftRadius:0, borderBottomRightRadius:0, borderBottom:'none'} : {}}>
                <input type="checkbox" checked={calcularPrestamo} onChange={e=>setCalcularPrestamo(e.target.checked)} />
                <div className="checkbox-content">
                  <span className="checkbox-label">Financiación local</span>
                  <span className="checkbox-desc">Simulación de cuotas bancarias con interés fijo.</span>
                </div>
              </label>
              {calcularPrestamo && (
                <div className="nested-form form-grid">
                  <div className="form-group">
                    <label>Aportación inicial (€)</label>
                    <input type="number" value={entrada} placeholder="Ej: 6000" onChange={e=>setEntrada(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Duración (Meses)</label>
                    <input type="number" value={mesesPrestamo} placeholder="Ej: 48" onChange={e=>setMesesPrestamo(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        <button className="btn-primary" style={{width:'100%'}} onClick={handleBuscar} disabled={!modeloSeleccionado || cargandoBusqueda}>
          {cargandoBusqueda ? 'Calculando...' : 'Calcular costes'}
        </button>
      </div>

      {/* Recibo / Sidebar */}
      {cocheData && resultados && (
        <div className="receipt-sidebar" id={`pdf-content-${panelId}`}>
          <div className="receipt-header">
            <h3>{cocheData.nombre}</h3>
            <div style={{display:'flex', gap:'var(--space-2)'}}>
              {user && (
                <button className="btn-ghost" style={{padding:'4px'}} onClick={handleGuardarGaraje} aria-label="Guardar" data-html2canvas-ignore>
                  <BookmarkIcon />
                </button>
              )}
              <button className="btn-ghost" style={{padding:'4px'}} onClick={handleDownloadPDF} aria-label="Descargar PDF" data-html2canvas-ignore>
                <DownloadIcon />
              </button>
            </div>
          </div>

          <div className="receipt-body">
            <div className="line-item">
              <span className="label">Coste base (Origen)</span>
              <span className="value">{resultados.precioFinalEur.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span>
            </div>
            
            <div className="divider"></div>
            <span className="eyebrow" style={{marginBottom:0}}>Impuestos y Tasas Gubernamentales</span>
            
            {mercadoSuizo && (
              <div className="line-item">
                <span className="label">Aranceles + IVA Extra-Comunitario (Suiza)</span>
                <span className="value">{resultados.aduanasEivaSuiza.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span>
              </div>
            )}
            
            <div className="line-item">
              <span className="label">Impuesto de Matriculación</span>
              <span className="value">{resultados.importeIm.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span>
            </div>
            <div className="line-item sub">
              <span className="label">Tramo: {resultados.porcentajeIm}% s/ Valor BOE Hacienda ({resultados.valorHacienda.toLocaleString('es-ES',{maximumFractionDigits:0})}€)</span>
            </div>

            {tipoVendedor === 'particular' && (
              <>
                <div className="line-item">
                  <span className="label">Impuesto Transmisiones (ITP)</span>
                  <span className="value">{resultados.importeITP.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span>
                </div>
                <div className="line-item sub">
                  <span className="label">Aplicado {(ITP_CCAA[comunidadAutonoma]*100).toFixed(1)}% para {comunidadAutonoma}</span>
                </div>
              </>
            )}

            <div className="line-item">
              <span className="label">Trámites fijos importación</span>
              <span className="value">{TOTAL_TRAMITES.toLocaleString('es-ES')} €</span>
            </div>
            <div className="line-item sub">
              <span className="label">ITV (150€), DGT (100€), Placas y Traducción</span>
            </div>

            <div className="divider"></div>
            <span className="eyebrow" style={{marginBottom:0}}>Logística y Mantenimiento</span>

            {tipoTransporte === 'conduciendo' && (
              <>
                <div className="line-item">
                  <span className="label">Coste Viaje Personal (Conduciendo)</span>
                  <span className="value">{resultados.costeTransporteTotal.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span>
                </div>
                <div className="line-item sub">
                  <span className="label">Vuelo (120€) + Hotel (80€) + Placas tránsito (180€) + Gasolina ({resultados.viajeDesglose.gasolina.toLocaleString('es-ES',{maximumFractionDigits:0})}€)</span>
                </div>
              </>
            )}

            {tipoTransporte === 'grua' && (
              <>
                <div className="line-item">
                  <span className="label">Coste Transporte (Grúa)</span>
                  <span className="value">{resultados.costeTransporteTotal.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span>
                </div>
                <div className="line-item sub">
                  <span className="label">Tarifa B2B base + 0.85€/km recorrido</span>
                </div>
              </>
            )}

            <div className="line-item">
              <span className="label">Seguro Anual (Estimado por riesgo de perfil y CP)</span>
              <span className="value">{resultados.seguroEstimadoAnual.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span>
            </div>

            <div className="divider"></div>
            <div className="line-item">
              <span className="label" style={{color: 'var(--text-primary)', fontWeight:500}}>Subtotal Gastos Extra</span>
              <span className="value">{resultados.totalCosteExtra.toLocaleString('es-ES',{maximumFractionDigits:0})} €</span>
            </div>
          </div>

          <div className="receipt-total">
            <div className="line-item">
              <span className="label">Total inversión</span>
              <span className="value">{resultados.totalPresupuesto.toLocaleString('es-ES', {maximumFractionDigits: 0})} €</span>
            </div>

            {calcularPrestamo && (
              <div style={{marginTop:'var(--space-3)', paddingTop:'var(--space-3)', borderTop:'1px dashed var(--border-color)'}}>
                <div className="line-item">
                  <span className="label">Cuota financiación</span>
                  <span className="value">{resultados.cuotaMensual.toLocaleString('es-ES', {maximumFractionDigits:2})} €/m</span>
                </div>
                <div className="line-item sub">
                  <span className="label">{mesesPrestamo} meses al {TIPO_INTERES_ANUAL*100}% TAE</span>
                </div>
              </div>
            )}
            
            <div className="badge-dgt" style={{
              backgroundColor: resultados.etiqueta.bg, 
              color: resultados.etiqueta.color, 
              borderColor: resultados.etiqueta.border
            }}>
              DGT {resultados.etiqueta.label}
            </div>
          </div>

          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-color)',
            borderBottomLeftRadius: 'var(--radius-lg)',
            borderBottomRightRadius: 'var(--radius-lg)'
          }}>
            <span className="eyebrow" style={{marginBottom: 'var(--space-3)'}}>Análisis de Mercado Avanzado</span>
            <div className="line-item">
              <span className="label">Valor España (Tasación inteligente)</span>
              <span className="value">{resultados.valorEstimadoEspana.toLocaleString('es-ES', {maximumFractionDigits: 0})} €</span>
            </div>
            <div className="line-item" style={{marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--border-color)'}}>
              <span className="label" style={{fontWeight: 500, color: 'var(--text-primary)'}}>
                {resultados.ahorroEstimado > 0 ? 'Ahorro importando' : 'Pérdida importando'}
              </span>
              <span className="value" style={{
                fontSize: '1.125rem', 
                fontWeight: 600, 
                color: resultados.ahorroEstimado > 0 ? '#10b981' : '#ef4444'
              }}>
                {resultados.ahorroEstimado > 0 ? '+' : ''}{resultados.ahorroEstimado.toLocaleString('es-ES', {maximumFractionDigits: 0})} €
              </span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
