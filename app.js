// ─── Estado global ───────────────────────────────────────────────
let db = JSON.parse(localStorage.getItem('invqr_db2') || '[]');

function saveDB() {
  try { localStorage.setItem('invqr_db2', JSON.stringify(db)); } catch(e) {}
}

// ─── Tabs ────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const tabs = document.querySelectorAll('.tab');
  const map = { gen: 0, qrs: 1, bars: 2 };
  tabs[map[name]].classList.add('active');
  document.getElementById(`panel-${name}`).classList.add('active');
  if (name === 'qrs') renderAllQRs();
  if (name === 'bars') renderAllBars();
}

// ─── GENERAR ─────────────────────────────────────────────────────
function getQRData(eq) {
  return `ID: ${eq.id}
EQUIPO: ${eq.nombre}
SERIE: ${eq.serie || 'N/A'}
MODELO: ${eq.modelo || 'N/A'}
UBICACIÓN: ${eq.ubicacion || 'N/A'}
RESPONSABLE: ${eq.responsable || 'N/A'}
ESTADO: ${eq.estado}
REGISTRO: ${eq.generado}`;
}

function generateAll() {
  const idVal = document.getElementById('f-id').value.trim();
  const nombre = document.getElementById('f-nombre').value.trim();

  if (!idVal) { alert('El ID del equipo es obligatorio.'); document.getElementById('f-id').focus(); return; }
  if (!nombre) { alert('El nombre del equipo es obligatorio.'); document.getElementById('f-nombre').focus(); return; }

  if (db.find(e => e.id === idVal)) {
    alert(`Ya existe un equipo con el ID "${idVal}". Usa un ID diferente.`);
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
    notas: document.getElementById('f-notas').value.trim(),
    generado: new Date().toLocaleDateString('es-MX')
  };

  db.push(equipo);
  saveDB();

  const statusColor = equipo.estado === 'Bueno' ? 'green' : equipo.estado === 'De baja' ? 'red' : 'amber';

  const out = document.getElementById('gen-output');
  out.innerHTML = `
    <div style="height:1px; background:var(--border); margin: 20px 0;"></div>
    <div class="gen-result">
      <div class="result-cols">
        <!-- QR -->
        <div class="code-block">
          <div class="code-label">Código QR</div>
          <div id="new-qr-${equipo.id}"></div>
          <span style="font-size:11px; color:var(--text3); font-family:'Courier New',monospace; text-align:center; max-width:140px;">Escanea para ver los datos del equipo</span>
          <button class="btn-sm" onclick="downloadQRImg('${equipo.id}', '${nombre.replace(/'/g,"\\'")}')">Descargar PNG</button>
        </div>
        <!-- Código de barras -->
        <div class="code-block">
          <div class="code-label">Código de barras</div>
          <div class="barcode-wrap" id="new-bar-${equipo.id}">
            <svg id="barsvg-${equipo.id}"></svg>
          </div>
          <span style="font-size:11px; color:var(--text3); font-family:'Courier New',monospace; text-align:center; max-width:160px;">Captura solo el ID al escanear</span>
          <button class="btn-sm" onclick="downloadBarcode('${equipo.id}', '${nombre.replace(/'/g,"\\'")}')">Descargar PNG</button>
        </div>
        <!-- Datos -->
        <div class="qr-data">
          <span class="badge badge-${statusColor}">${equipo.estado}</span>
          <div class="data-row"><div class="lbl">ID</div><div class="val" style="font-family:'Courier New',monospace; font-size:15px; font-weight:bold;">${equipo.id}</div></div>
          <div class="data-row"><div class="lbl">Equipo</div><div class="val" style="font-size:16px;">${nombre}</div></div>
          ${equipo.serie ? `<div class="data-row"><div class="lbl">Serie</div><div class="val">${equipo.serie}</div></div>` : ''}
          ${equipo.modelo ? `<div class="data-row"><div class="lbl">Modelo</div><div class="val">${equipo.modelo}</div></div>` : ''}
          ${equipo.ubicacion ? `<div class="data-row"><div class="lbl">Ubicación</div><div class="val">${equipo.ubicacion}</div></div>` : ''}
          ${equipo.responsable ? `<div class="data-row"><div class="lbl">Responsable</div><div class="val">${equipo.responsable}</div></div>` : ''}
          <p style="font-size:12px; color:var(--text3); margin-top:12px; font-family:'Courier New',monospace;">✓ QR contiene todos los datos en texto<br>✓ Código de barras captura solo el ID</p>
        </div>
      </div>
    </div>`;

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
          size: 150,
          level: 'M'
        });
      }
    } catch(e) { console.error('QR error', e); }

    try {
      JsBarcode(`#barsvg-${equipo.id}`, equipo.id, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 13,
        margin: 8,
        lineColor: '#1a1814',
        background: '#ffffff'
      });
    } catch(e) { console.error('Barcode error', e); }
  }, 200);
}

// ─── DESCARGAS ───────────────────────────────────────────────────
function downloadQRImg(id, nombre) {
  const el = document.querySelector(`#new-qr-${id} canvas`);
  if (!el) { alert('Genera el QR primero.'); return; }
  const a = document.createElement('a');
  a.download = `QR_${nombre}_${id}.png`;
  a.href = el.toDataURL('image/png');
  a.click();
}

function downloadBarcode(id, nombre) {
  const svg = document.getElementById(`barsvg-${id}`);
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
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
  ['f-id','f-nombre','f-serie','f-modelo','f-ubicacion','f-responsable','f-notas','f-fecha'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-categoria').value = '';
  document.getElementById('f-estado').value = 'Bueno';
  document.getElementById('gen-output').innerHTML = '';
}

// ─── PANEL: TODOS LOS QR ─────────────────────────────────────────
function renderAllQRs() {
  const container = document.getElementById('all-qr-list');
  const info = document.getElementById('qr-info');
  const actions = document.getElementById('qr-actions');

  if (db.length === 0) {
    container.innerHTML = '<div class="empty-msg">— no hay QR generados todavía —</div>';
    info.style.display = 'none';
    actions.style.display = 'none';
    return;
  }

  info.textContent = `${db.length} equipo${db.length !== 1 ? 's' : ''} registrado${db.length !== 1 ? 's' : ''}`;
  info.style.display = 'block';
  actions.style.display = 'flex';

  container.innerHTML = '<div class="all-grid" id="all-qr-grid"></div>';
  const grid = document.getElementById('all-qr-grid');

  db.forEach((eq, i) => {
    const card = document.createElement('div');
    card.className = 'code-card';
    card.innerHTML = `
      <div id="aqr-${i}"></div>
      <strong>${eq.nombre}</strong>
      <div class="card-id">${eq.id}</div>
      <div style="font-size:11px; color:var(--text3); margin-top:2px;">${eq.generado || ''}</div>`;
    grid.appendChild(card);

    setTimeout(() => {
      try {
        const qrElement = document.getElementById(`aqr-${i}`);
        if (qrElement) {
          qrElement.innerHTML = "";
          const canvas = document.createElement('canvas');
          qrElement.appendChild(canvas);
          new QRious({
            element: canvas,
            value: getQRData(eq),
            size: 120,
            level: 'M'
          });
        }
      } catch(e) {
        console.error("Error generando QR para " + eq.id, e);
      }
    }, 50 * i + 50);
  });
}

// ─── PANEL: TODOS LOS CÓDIGOS DE BARRAS ──────────────────────────
function renderAllBars() {
  const container = document.getElementById('all-bar-list');
  const info = document.getElementById('bar-info');
  const actions = document.getElementById('bar-actions');

  if (db.length === 0) {
    container.innerHTML = '<div class="empty-msg">— no hay códigos de barras generados todavía —<br>Ve a "Generar" para empezar.</div>';
    info.style.display = 'none';
    actions.style.display = 'none';
    return;
  }

  info.textContent = `${db.length} equipo${db.length !== 1 ? 's' : ''} registrado${db.length !== 1 ? 's' : ''}`;
  info.style.display = 'block';
  actions.style.display = 'flex';

  container.innerHTML = '<div class="all-grid" id="all-bar-grid"></div>';
  const grid = document.getElementById('all-bar-grid');

  db.forEach((eq, i) => {
    const card = document.createElement('div');
    card.className = 'code-card';
    card.innerHTML = `
      <div class="barcode-card-wrap">
        <svg id="abar-${i}"></svg>
      </div>
      <strong>${eq.nombre}</strong>
      <div class="card-id">${eq.id}</div>`;
    grid.appendChild(card);
    setTimeout(() => {
      try {
        JsBarcode(`#abar-${i}`, eq.id, {
          format: 'CODE128',
          width: 1.8,
          height: 50,
          displayValue: true,
          fontSize: 11,
          margin: 6,
          lineColor: '#1a1814',
          background: '#ffffff'
        });
      } catch(e) {}
    }, 40 * i);
  });
}

// ─── BORRAR ──────────────────────────────────────────────────────
function clearAllQRs() {
  if (!confirm(`¿Borrar los ${db.length} equipos guardados? Esta acción no se puede deshacer.`)) return;
  db = [];
  saveDB();
  renderAllQRs();
  renderAllBars();
}

// ─── IMPRIMIR PANEL ──────────────────────────────────────────────
function printPanel(which) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('print-target'));
  document.getElementById(`panel-${which}`).classList.add('print-target');
  window.print();
}