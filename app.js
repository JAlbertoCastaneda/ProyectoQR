// FIREBASE CONFIG - TU PROYECTO
const firebaseConfig = {
  apiKey: "AIzaSyD1j68jVrkmrM-R7nzJBj9yDMXyUdExYi4",
  authDomain: "inventario-qr-3575a.firebaseapp.com",
  projectId: "inventario-qr-3575a",
  storageBucket: "inventario-qr-3575a.firebasestorage.app",
  messagingSenderId: "680834276718",
  appId: "1:680834276718:web:4a5fc25fe26cf10244b57f",
  measurementId: "G-L5YBSSXCXQ"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ─── Variables globales ──────────────────────────────────────────
let allEquipos = [];
let searchTimeout;

// ─── Tabs ───────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const tabs = document.querySelectorAll('.tab');
  const map = { gen: 0, qrs: 1, bars: 2, search: 3 };
  tabs[map[name]].classList.add('active');
  document.getElementById(`panel-${name}`).classList.add('active');
  
  if (name === 'qrs') loadAllEquipos().then(renderAllQRs);
  if (name === 'bars') loadAllEquipos().then(renderAllBars);
  if (name === 'search') document.getElementById('search-input').focus();
}

// ─── CARGAR / GUARDAR FIREBASE ───────────────────────────────────
async function loadAllEquipos() {
  try {
    console.log('🔄 Cargando de Firebase...');
    const snapshot = await db.collection('equipos').get();
    allEquipos = snapshot.docs.map(doc => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
    console.log(`✅ ${allEquipos.length} equipos cargados`);
    return allEquipos;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

async function guardarEquipo(equipo) {
  try {
    await db.collection('equipos').add({
      ...equipo,
      generado: new Date().toLocaleDateString('es-MX'),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error guardando:', error);
    return false;
  }
}

async function clearAll() {
  if (!confirm(`🗑️ ¿Borrar los ${allEquipos.length} equipos de Firebase?\n❌ NO se puede deshacer`)) return;
  
  try {
    // ✅ OBTENER TODOS LOS DOCUMENTOS DIRECTAMENTE
    const snapshot = await db.collection('equipos').get();
    
    if (snapshot.empty) {
      alert('✅ No hay equipos para eliminar');
      return;
    }
    
    // ✅ BATCH con REFERENCIAS REALES
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);  // ✅ doc.ref es la referencia REAL
    });
    
    await batch.commit();
    
    allEquipos = [];  // ✅ Limpiar localmente
    alert(`✅ ¡${snapshot.size} equipos ELIMINADOS de Firebase!`);
    
    renderAllQRs();
    renderAllBars();
    
  } catch (error) {
    console.error('❌ Error eliminando:', error);
    alert('❌ Error: ' + error.message);
  }
}

// ─── GENERAR ────────────────────────────────────────────────────
function getQRData(eq) {
  const lines = [
    `ID: ${eq.id}`,
    `EQUIPO: ${eq.nombre}`,
    `SERIE: ${eq.serie || 'N/A'}`,
    `MODELO: ${eq.modelo || 'N/A'}`,
    `UBICACIÓN: ${eq.ubicacion || 'N/A'}`,
    `RESPONSABLE: ${eq.responsable || 'N/A'}`,
    `ESTADO: ${eq.estado}`,
    `REGISTRO: ${eq.generado}`
  ];

  if (eq.notas && eq.notas.trim()) {
    lines.push('');
    lines.push('NOTAS:');
    lines.push(eq.notas);
  }

  return lines.join('\n');
}

async function generateAll() {
  const idVal = document.getElementById('f-id').value.trim();
  const nombre = document.getElementById('f-nombre').value.trim();

  if (!idVal || !nombre) {
    alert('ID y nombre son obligatorios');
    return;
  }

  // Verificar duplicado
  const existe = allEquipos.find(e => e.id === idVal);
  if (existe) {
    alert(`Ya existe "${idVal}". Usa otro ID.`);
    return;
  }

  const equipo = {
    id: idVal,
    nombre,
    serie: document.getElementById('f-serie').value.trim(),
    modelo: document.getElementById('f-modelo').value.trim(),
    categoria: document.getElementById('f-categoria').value,
    ubicacion: document.getElementById('f-ubicacion').value.trim(),
    responsable: document.getElementById('f-responsable').value.trim(),
    estado: document.getElementById('f-estado').value,
    fecha: document.getElementById('f-fecha').value,
    notas: document.getElementById('f-notas').value.trim()
  };

  // Loading
  document.getElementById('gen-btn-text').style.display = 'none';
  document.getElementById('gen-loading').style.display = 'inline';

  const guardado = await guardarEquipo(equipo);
  await loadAllEquipos(); // Recargar lista

  // Mostrar resultado (IGUAL que antes)
  document.getElementById('gen-btn-text').style.display = 'inline';
  document.getElementById('gen-loading').style.display = 'none';

  if (!guardado) {
    alert('Error guardando. Revisa tu conexión.');
    return;
  }

  // Generar vista previa (tu código original)
  const statusColor = equipo.estado === 'Bueno' ? 'good' : equipo.estado === 'De baja' ? 'bad' : 'regular';
  const out = document.getElementById('gen-output');
  out.innerHTML = `
    <div style="height:1px; background:var(--border); margin: 20px 0;"></div>
    <div class="gen-result">
      <div class="result-cols">
        <div class="code-block">
          <div class="code-label"> Guardado en Firebase</div>
          <div id="new-qr-${equipo.id}"></div>
          <button class="btn-sm" onclick="downloadQRImg('${equipo.id}', '${nombre.replace(/'/g,"\\'")}')">📥 PNG</button>
        </div>
        <div class="code-block">
          <div class="code-label">Código de barras</div>
          <div class="barcode-wrap" id="new-bar-${equipo.id}">
                      <svg id="barsvg-${equipo.id}"></svg>
          </div>
          <button class="btn-sm" onclick="downloadBarcode('${equipo.id}', '${nombre.replace(/'/g,"\\'")}')">📥 PNG</button>
        </div>
        <div class="qr-data">
          <span class="badge badge-${statusColor}">${equipo.estado}</span>
          <div class="data-row"><div class="lbl">ID</div><div class="val" style="font-family:'Courier New',monospace;">${equipo.id}</div></div>
          <div class="data-row"><div class="lbl">Equipo</div><div class="val">${nombre}</div></div>
        </div>
      </div>
    </div>`;

  // Generar códigos visuales
 setTimeout(() => {
  try {
    const qrEl = document.getElementById(`new-qr-${equipo.id}`);
    if (qrEl) {
      qrEl.innerHTML = "";
      const canvas = document.createElement('canvas');
      qrEl.appendChild(canvas);
      new QRious({
        element: canvas,
        value: getQRData(equipo),
        size: 160,
        level: 'M'
      });
    }
  } catch(e) {
    console.error("QR error:", e);
  }

  setTimeout(() => {
    try {
      const svgId = `barsvg-${equipo.id}`;
      const svgEl = document.getElementById(svgId);
      
      if (svgEl) {
        JsBarcode(`#${svgId}`, equipo.id, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 13
        });
        console.log(` Barcode generado: ${svgId}`);
      } else {
        console.error(` SVG no encontrado: #${svgId}`);
      }
    } catch(e) {
      console.error("Barcode error:", e);
    }
  }, 300); 

}, 400); 
}

// ─── BUSCADOR  ─────────────────────────────────────────────────
function debouncedSearch(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => performSearch(query), 300);
}

async function performSearch(query) {
  console.log(' Buscando "' + query + '"');
  
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<div style="padding:20px;text-align:center">⏳ Buscando...</div>';

  try {
    const equipos = await loadAllEquipos();
    
    if (equipos.length === 0) {
      resultsEl.innerHTML = '<div class="empty-msg">No hay equipos</div>';
      return;
    }

    const q = query.toLowerCase();
    const matches = equipos.filter(e => 
      e.id.toLowerCase().includes(q) ||
      e.nombre.toLowerCase().includes(q) ||
      (e.serie && e.serie.toLowerCase().includes(q))
    );

    console.log(' Total:', equipos.length, 'Matches:', matches.length);
    console.log('Matches IDs:', matches.map(e=>e.id));

    if (matches.length === 0) {
      resultsEl.innerHTML = `<div class="empty-msg">
        No encontrado "${query}"<br>
        <small>Equipos disponibles: ${equipos.map(e=>e.id).join(', ')}</small>
      </div>`;
      return;
    }

 // MOSTRAR RESULTADOS
    resultsEl.innerHTML = matches.map(eq => `
      <div class="search-result">
        <h3 style="margin:0 0 10px 0;font-size:18px">${eq.nombre}</h3>
        <div style="background:#f0f0f0;padding:8px;border-radius:6px;font-family:monospace;font-size:14px">
          ID: <strong>${eq.id}</strong>
        </div>
        <p><strong>Serie:</strong> ${eq.serie || 'N/A'}</p>
        <p><strong>Estado:</strong> ${eq.estado}</p>
      </div>
    `).join('');

  } catch (error) {
    console.error('❌', error);
    resultsEl.innerHTML = '<div class="empty-msg">Error: ' + error.message + '</div>';
  }
}

// ─── RENDER PANOLES ──────────────────────────────────────────────
async function renderAllQRs() {
  const container = document.getElementById('all-qr-list');
  const info = document.getElementById('qr-info');
  const actions = document.getElementById('qr-actions');
  const countEl = document.getElementById('qr-count');
  const plural1 = document.getElementById('qr-plural');
  const plural2 = document.getElementById('qr-plural2');

  await loadAllEquipos();

  if (allEquipos.length === 0) {
    container.innerHTML = '<div class="empty-msg">— Registra tu primer equipo en "Generar" —</div>';
    info.style.display = actions.style.display = 'none';
    return;
  }

  // INFO
  countEl.textContent = allEquipos.length;
  plural1.textContent = plural2.textContent = allEquipos.length === 1 ? '' : 's';
  info.style.display = 'block';
  actions.style.display = 'flex';

  // GRID
  container.innerHTML = '<div class="all-grid" id="all-qr-grid"></div>';
  const grid = document.getElementById('all-qr-grid');

  allEquipos.forEach((eq, i) => {
    const card = document.createElement('div');
    card.className = 'code-card';
    card.innerHTML = `
      <div id="aqr-${i}"></div>
      <strong>${eq.nombre}</strong>
      <div class="card-id">${eq.id}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">${eq.generado}</div>`;
    grid.appendChild(card);

    setTimeout(() => {
      try {
        const qrElement = document.getElementById(`aqr-${i}`);
        qrElement.innerHTML = "";
        const canvas = document.createElement('canvas');
        qrElement.appendChild(canvas);
        new QRious({
          element: canvas,
          value: getQRData(eq),
          size: 140,
          level: 'M'
        });
      } catch(e) {
        console.error("QR error:", e);
      }
    }, 50 * i + 50);
  });
}


// ─── RENDER BARCODES (COMPLETO + UNIFORME) ──────────────────────
async function renderAllBars() {
  const container = document.getElementById('all-bar-list');
  const info = document.getElementById('bar-info');
  const actions = document.getElementById('bar-actions');
  const countEl = document.getElementById('bar-count');
  const plural1 = document.getElementById('bar-plural');
  const plural2 = document.getElementById('bar-plural2');

  await loadAllEquipos();

  if (allEquipos.length === 0) {
    container.innerHTML = '<div class="empty-msg">— Genera códigos de barras primero —</div>';
    info.style.display = actions.style.display = 'none';
    return;
  }

  // INFO
  countEl.textContent = allEquipos.length;
  plural1.textContent = plural2.textContent = allEquipos.length === 1 ? '' : 's';
  info.style.display = 'block';
  actions.style.display = 'flex';

  // GRID
  container.innerHTML = '<div class="all-grid" id="all-bar-grid"></div>';
  const grid = document.getElementById('all-bar-grid');

  allEquipos.forEach((eq, i) => {
    const card = document.createElement('div');
    card.className = 'code-card';
    card.innerHTML = `
      <div class="barcode-card-wrap">
        <svg id="abar-${i}"></svg>
      </div>
      <strong>${eq.nombre}</strong>
      <div class="card-id">${eq.id}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">${eq.generado}</div>`;
    grid.appendChild(card);

    setTimeout(() => {
      try {
        JsBarcode(`#abar-${i}`, eq.id, {
          format: 'CODE128',
          width: 2.2,
          height: 70,
          displayValue: true,
          fontSize: 15,
          margin: 6,
          lineColor: '#1a1814',
          background: '#ffffff'
        });
      } catch(e) {
        console.error("Barcode error:", e);
      }
    }, 40 * i);
  });
}
// ─── FUNCIONES ANTIGUAS (sin cambios) ────────────────────────────
function downloadQRImg(id, nombre) {
  const el = document.querySelector(`#new-qr-${id} canvas, #aqr-${allEquipos.findIndex(e=>e.id===id)} canvas`);
  if (!el) return;
  const a = document.createElement('a');
  a.download = `QR_${nombre}_${id}.png`;
  a.href = el.toDataURL('image/png');
  a.click();
}

function downloadBarcode(id, nombre) {
  const svg = document.querySelector(`#barsvg-${id}, #abar-${allEquipos.findIndex(e=>e.id===id)}`);
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const img = new Image();
  const svgBlob = new Blob([svgData], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = `BAR_${nombre}_${id}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function clearForm() {
  document.querySelectorAll('#panel-gen input, #panel-gen textarea, #panel-gen select').forEach(el => {
    if (el.tagName === 'INPUT' && el.type === 'date') el.value = '';
    else if (el.tagName === 'SELECT') el.value = '';
    else el.value = '';
  });
  document.getElementById('f-estado').value = 'Bueno';
  document.getElementById('gen-output').innerHTML = '';
}

async function printSingle(eqId) {
  const eq = allEquipos.find(e => e.id === eqId);
  if (!eq) return;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html><head><title>Imprimir ${eq.nombre}</title>
    <style>
      body { font-family: Arial; margin: 20px; }
      .print-qr { text-align: center; margin: 20px 0; }
      canvas { border: 1px solid #ccc; }
    </style></head><body>
    <h2>${eq.nombre} - ${eq.id}</h2>
    <div class="print-qr">
      <canvas id="print-qr"></canvas><br>
      <svg id="print-bar"></svg>
    </div>
    <p><strong>Estado:</strong> ${eq.estado} | <strong>Ubicación:</strong> ${eq.ubicacion || 'N/A'}</p>
    </body></html>`);
  
  printWindow.document.close();
  await new Promise(r => setTimeout(r, 100));
  
  const canvas = printWindow.document.getElementById('print-qr');
  new QRious({
    element: canvas,
    value: getQRData(eq),
    size: 200
  });
  
  JsBarcode(printWindow.document.getElementById('print-bar'), eq.id, {
    width: 2, height: 80, displayValue: true, fontSize: 16
  });
  
  printWindow.print();
}

function printPanel(which) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('print-target'));
  document.getElementById(`panel-${which}`).classList.add('print-target');
  window.print();
}

// ─── INICIALIZAR ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-fecha').valueAsDate = new Date();
  switchTab('gen');
});
    