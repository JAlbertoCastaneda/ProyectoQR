// FIREBASE CONFIG - TU PROYECTO
let editingEquipoId = null;
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
async function actualizarEquipo(docId, equipo) {
  try {
    await db.collection('equipos').doc(docId).update({
      ...equipo,
      modificado: new Date().toLocaleDateString('es-MX'),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    editingEquipoId = null; // ← se limpia en resetGenerateBtn
    return true;
  } catch (error) {
    console.error('Error actualizando:', error);
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
    alert('❌ ID y nombre son obligatorios');
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

  // 🔄 LOADING
  const btnText = document.getElementById('gen-btn-text');
  const btnLoading = document.getElementById('gen-loading');
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline';
  btnLoading.textContent = editingEquipoId ? 'Actualizando...' : 'Guardando...';

  try {
    let guardado = false;

    if (editingEquipoId) {
      // ✏️ MODO EDITAR
      guardado = await actualizarEquipo(editingEquipoId, equipo);
      alert('✅ ¡Equipo actualizado en Firebase!');
    } else {
      // ➕ MODO NUEVO
      const existe = allEquipos.find(e => e.id === idVal);
      if (existe) {
        alert(`⚠️ Ya existe "${idVal}". Usa otro ID o edita el existente.`);
        resetGenerateBtn();
        return;
      }
      guardado = await guardarEquipo(equipo);
      alert('✅ ¡Equipo guardado en Firebase!');
    }

    await loadAllEquipos();
    showPreview(equipo);
    resetGenerateBtn();

  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error: ' + error.message);
    resetGenerateBtn();
  }
}

// 🔧 FUNCIONES AUXILIARES
function resetGenerateBtn() {
  const btnText = document.getElementById('gen-btn-text');
  const btnLoading = document.getElementById('gen-loading');
  btnText.style.display = 'inline';
  btnLoading.style.display = 'none';
  btnText.textContent = 'Generar';
  editingEquipoId = null; // ✅ siempre limpiar aquí
}

function startEdit(equipo, docId) {
  currentModalEquipo = equipo;
  
  // 📝 LLENAR FORMULARIO
  document.getElementById('f-id').value = equipo.id;
  document.getElementById('f-nombre').value = equipo.nombre;
  document.getElementById('f-serie').value = equipo.serie || '';
  document.getElementById('f-modelo').value = equipo.modelo || '';
  document.getElementById('f-categoria').value = equipo.categoria || '';
  document.getElementById('f-ubicacion').value = equipo.ubicacion || '';
  document.getElementById('f-responsable').value = equipo.responsable || '';
  document.getElementById('f-estado').value = equipo.estado;
  document.getElementById('f-fecha').value = equipo.fecha || '';
  document.getElementById('f-notas').value = equipo.notas || '';
  
  // ✅ Asignar ANTES de switchTab para que el botón se renderice correctamente
  editingEquipoId = docId;

  // 🔄 CAMBIAR PESTAÑA
  switchTab('gen');
  
  // 🎨 CAMBIAR BOTÓN
  const btnText = document.getElementById('gen-btn-text');
  btnText.textContent = 'Actualizar';
}

function showPreview(equipo) {
  const statusColor = getStatusColor(equipo.estado);
  const out = document.getElementById('gen-output');
  
  out.innerHTML = `
    <div style="height:1px;background:var(--border);margin:20px 0;"></div>
    <div class="gen-result">
      <div class="result-cols">
        <div class="code-block">
          <div class="code-label">✅ Guardado en Firebase</div>
          <div id="new-qr-${equipo.id.replace(/[^a-z0-9]/gi,'')}"></div>
          <button class="btn-sm" onclick="downloadQRImg('${equipo.id}', '${equipo.nombre.replace(/'/g,"\\'")}')">📥 PNG</button>
        </div>
        <div class="code-block">
          <div class="code-label">Código de barras</div>
          <div class="barcode-wrap" id="new-bar-${equipo.id.replace(/[^a-z0-9]/gi,'')}"></div>
          <button class="btn-sm" onclick="downloadBarcode('${equipo.id}', '${equipo.nombre.replace(/'/g,"\\'")}')">📥 PNG</button>
        </div>
        <div class="qr-data">
          <span class="badge badge-${statusColor}">${equipo.estado}</span>
          <div class="data-row"><div class="lbl">ID</div><div class="val" style="font-family:'Courier New',monospace;">${equipo.id}</div></div>
          <div class="data-row"><div class="lbl">Equipo</div><div class="val">${equipo.nombre}</div></div>
        </div>
      </div>
    </div>`;

  // 🎨 GENERAR CÓDIGOS VISUALES
  setTimeout(() => generatePreviewCodes(equipo), 200);
}
function generatePreviewCodes(equipo) {
  const safeId = equipo.id.replace(/[^a-z0-9]/gi, '');
  
  // QR
  try {
    const qrEl = document.getElementById(`new-qr-${safeId}`);
    if (qrEl) {
      qrEl.innerHTML = '';
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
    console.error('QR error:', e);
  }

  // Barcode
  setTimeout(() => {
    try {
      const barEl = document.getElementById(`new-bar-${safeId}`);
      if (barEl) {
        const svgId = `newbar-svg-${safeId}`;
        barEl.innerHTML = `<svg id="${svgId}"></svg>`;
        JsBarcode(`#${svgId}`, equipo.id, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 13
        });
      }
    } catch(e) {
      console.error('Barcode error:', e);
    }
  }, 100);
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
  <div class="search-result" onclick="openDetail(${JSON.stringify(eq).replace(/"/g, '&quot;')}, '${eq.firebaseId}')" style="cursor:pointer; border-radius:8px; transition: all 0.2s;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3 style="margin:0;font-size:18px">${eq.nombre}</h3>
      <span class="badge badge-${getStatusColor(eq.estado)}">${eq.estado}</span>
    </div>
    <div style="background:#f0f0f0;padding:12px;border-radius:6px;font-family:monospace;font-size:14px;margin:10px 0;">
      ID: <strong>${eq.id}</strong>
    </div>
    <div style="font-size:12px;color:var(--text2);">
      📍 ${eq.ubicacion || 'Sin ubicación'} • 👤 ${eq.responsable || 'Sin responsable'}
    </div>
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
    card.style.cursor = 'pointer';
    card.title = 'Ver detalle del equipo';
    card.innerHTML = `
      <div id="aqr-${i}"></div>
      <strong>${eq.nombre}</strong>
      <div class="card-id">${eq.id}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">${eq.generado}</div>`;
    card.addEventListener('click', () => openDetail(eq, eq.firebaseId));
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
    card.style.cursor = 'pointer';
    card.title = 'Ver detalle del equipo';
    card.innerHTML = `
      <div class="barcode-card-wrap">
        <svg id="abar-${i}"></svg>
      </div>
      <strong>${eq.nombre}</strong>
      <div class="card-id">${eq.id}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">${eq.generado}</div>`;
    card.addEventListener('click', () => openDetail(eq, eq.firebaseId));
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
// ═══════════════════════════════════════════════ MODAL DETALLE
let currentModalEquipo = null;
let currentModalDocId = null; // ✅ AGREGADO para editar/eliminar

async function openDetail(equipo, docId) {
  currentModalEquipo = equipo;
  currentModalDocId = docId; // ✅ GUARDAR ID del documento
  console.log('Abriendo modal:', equipo.id, docId); // DEBUG
  
  document.getElementById('detail-modal').style.display = 'flex';
  await renderModalDetail(equipo);
  document.body.style.overflow = 'hidden';
}

async function renderModalDetail(equipo) {
  // Título
  document.getElementById('modal-title').textContent = `${equipo.nombre} - ${equipo.id}`;
  
  // Datos (IGUAL)
  document.getElementById('modal-data').innerHTML = `
    <div class="data-row"><div class="lbl">ID:</div><div><strong>${equipo.id}</strong></div></div>
    <div class="data-row"><div class="lbl">Equipo:</div><div>${equipo.nombre}</div></div>
    <div class="data-row"><div class="lbl">Serie:</div><div>${equipo.serie || 'N/A'}</div></div>
    <div class="data-row"><div class="lbl">Modelo:</div><div>${equipo.modelo || 'N/A'}</div></div>
    <div class="data-row"><div class="lbl">Categoría:</div><div>${equipo.categoria || 'N/A'}</div></div>
    <div class="data-row"><div class="lbl">Ubicación:</div><div>${equipo.ubicacion || 'N/A'}</div></div>
    <div class="data-row"><div class="lbl">Responsable:</div><div>${equipo.responsable || 'N/A'}</div></div>
    <div class="data-row"><div class="lbl">Estado:</div><div><span class="badge badge-${getStatusColor(equipo.estado)}">${equipo.estado}</span></div></div>
    <div class="data-row"><div class="lbl">Fecha:</div><div>${equipo.fecha || 'N/A'}</div></div>
    ${equipo.notas ? `<div class="data-row"><div class="lbl">Notas:</div><div>${equipo.notas}</div></div>` : ''}
  `;
  
  // ✅ CÓDIGOS con MEJOR timing
  setTimeout(() => generateModalCodes(equipo), 100);
}

function generateModalQR(eq) {
  const qrEl = document.getElementById('modal-qr');
  qrEl.innerHTML = '';
  const canvas = document.createElement('canvas');
  qrEl.appendChild(canvas);
  new QRious({
    element: canvas,
    value: getQRData(eq),
    size: 180,
    level: 'M'
  });
}

function generateModalBarcode(eq) {
  const barEl = document.getElementById('modal-barcode');
  barEl.innerHTML = '<svg id="modal-bar-svg"></svg>';
  JsBarcode('#modal-bar-svg', eq.id, {
    format: 'CODE128',
    width: 2.5,
    height: 80,
    displayValue: true,
    fontSize: 16
  });
}
function generateModalCodes(eq) {
  try {
    generateModalQR(eq);
  } catch(e) {
    console.error('Modal QR error:', e);
  }
  
  try {
    generateModalBarcode(eq);
  } catch(e) {
    console.error('Modal Barcode error:', e);
  }
}

function getStatusColor(estado) {
  return estado === 'Bueno' ? 'good' : 
         estado === 'De baja' ? 'bad' : 'regular';
}

// ═══════════════════════════════════════════════ ACCIONES
function printSingleModal(type) {
  const eq = currentModalEquipo;
  if (!eq) {
    alert('❌ Error: No hay equipo seleccionado');
    return;
  }

  const qrData = getQRData(eq);
  const safeQrData = qrData.replace(/\\/g, '\\\\').replace(/`/g, '\\`');

  const printWindow = window.open('', '_blank', 'width=600,height=500');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html><head>
      <title>Imprimir ${eq.id}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"><\/script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js"><\/script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: white; display: flex; justify-content: center; align-items: flex-start; padding: 20px; }

        .code-card {
          background: white;
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 14px;
          width: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          font-family: Georgia, serif;
        }

        .card-code-area {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: ${type === 'qr' ? '140px' : '90px'};
          width: 100%;
        }

        .card-code-area canvas {
          max-width: 140px;
          max-height: 140px;
          border-radius: 4px;
        }

        .card-code-area svg {
          max-width: 100%;
          max-height: 80px;
        }

        .card-name {
          font-size: 13px;
          font-weight: normal;
          margin-top: 8px;
          color: #1a1814;
        }

        .card-id {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          color: #6b6560;
          margin-top: 4px;
        }

        .card-date {
          font-size: 11px;
          color: #9b958e;
          margin-top: 2px;
        }

        @media print {
          body { padding: 0; }
          .code-card { border: 1px solid #aaa; }
        }
      </style>
    </head><body>
      <div class="code-card">
        <div class="card-code-area">
          ${type === 'qr' ? '<canvas id="print-code"></canvas>' : '<svg id="print-code"></svg>'}
        </div>
        <div class="card-name">${eq.nombre}</div>
        <div class="card-id">${eq.id}</div>
        <div class="card-date">${eq.generado || ''}</div>
      </div>

      <script>
        function waitForLibs() {
          if (typeof QRious !== 'undefined' && typeof JsBarcode !== 'undefined') {
            generateCode();
          } else {
            setTimeout(waitForLibs, 150);
          }
        }

        function generateCode() {
          if ('${type}' === 'qr') {
            new QRious({
              element: document.getElementById('print-code'),
              value: \`${safeQrData}\`,
              size: 140,
              level: 'M'
            });
          } else {
            JsBarcode('#print-code', '${eq.id}', {
              format: 'CODE128',
              width: 2.2,
              height: 70,
              displayValue: true,
              fontSize: 15,
              margin: 6,
              lineColor: '#1a1814',
              background: '#ffffff'
            });
          }
          setTimeout(() => { window.print(); }, 300);
        }

        waitForLibs();
      <\/script>
    </body></html>
  `);

  printWindow.document.close();
}

function editModal() {
  if (!currentModalEquipo || !currentModalDocId) {
    alert('❌ Error: No se pudo cargar los datos');
    return;
  }
  openEditModal(currentModalEquipo, currentModalDocId);
}

// ═══════════════════════════════════════════════ MODAL EDICIÓN
function openEditModal(equipo, docId) {
  document.getElementById('edit-id').value          = equipo.id;
  document.getElementById('edit-nombre').value      = equipo.nombre;
  document.getElementById('edit-serie').value       = equipo.serie || '';
  document.getElementById('edit-modelo').value      = equipo.modelo || '';
  document.getElementById('edit-categoria').value   = equipo.categoria || '';
  document.getElementById('edit-ubicacion').value   = equipo.ubicacion || '';
  document.getElementById('edit-responsable').value = equipo.responsable || '';
  document.getElementById('edit-estado').value      = equipo.estado;
  document.getElementById('edit-fecha').value       = equipo.fecha || '';
  document.getElementById('edit-notas').value       = equipo.notas || '';
  document.getElementById('edit-docid').value       = docId;

  document.getElementById('edit-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

async function saveEditModal() {
  const docId = document.getElementById('edit-docid').value;
  if (!docId) { alert('❌ Error interno: sin ID de documento'); return; }

  const equipo = {
    id:          document.getElementById('edit-id').value.trim(),
    nombre:      document.getElementById('edit-nombre').value.trim(),
    serie:       document.getElementById('edit-serie').value.trim(),
    modelo:      document.getElementById('edit-modelo').value.trim(),
    categoria:   document.getElementById('edit-categoria').value,
    ubicacion:   document.getElementById('edit-ubicacion').value.trim(),
    responsable: document.getElementById('edit-responsable').value.trim(),
    estado:      document.getElementById('edit-estado').value,
    fecha:       document.getElementById('edit-fecha').value,
    notas:       document.getElementById('edit-notas').value.trim()
  };

  if (!equipo.id || !equipo.nombre) {
    alert('❌ ID y nombre son obligatorios');
    return;
  }

  const btn = document.getElementById('edit-save-btn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    await db.collection('equipos').doc(docId).update({
      ...equipo,
      modificado: new Date().toLocaleDateString('es-MX'),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    await loadAllEquipos();

    // Actualizar datos del modal de detalle para que refleje los cambios
    currentModalEquipo = { ...equipo, firebaseId: docId };
    currentModalDocId  = docId;
    await renderModalDetail(currentModalEquipo);

    closeEditModal();
    alert('✅ Equipo actualizado correctamente');

    // Refrescar resultados de búsqueda si hay texto
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim()) {
      performSearch(searchInput.value.trim());
    }

  } catch (error) {
    console.error('❌ Error actualizando:', error);
    alert('❌ Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }
}
async function deleteSingleModal() {
  if (!currentModalDocId) {
    alert('❌ Error: No se encontró el documento');
    return;
  }
  
  if (!confirm(`🗑️ ¿Eliminar "${currentModalEquipo.nombre}"?\nNo se puede deshacer`)) return;
  
  try {
    await db.collection('equipos').doc(currentModalDocId).delete();
    alert('✅ Equipo eliminado correctamente');
    closeModal();
    await loadAllEquipos();
    performSearch(document.getElementById('search-input').value);
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error: ' + error.message);
  }
}
  // ✅ FUNCIONES AUXILIARES

function closeModal() {
  document.getElementById('detail-modal').style.display = 'none';
  document.body.style.overflow = 'auto';
  currentModalEquipo = null;
  currentModalDocId = null;
}


// ─── INICIALIZAR ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-fecha').valueAsDate = new Date();
  switchTab('gen');
});
    