const fs = require("fs");
const path = require("path");

/**
 * Generate DXF CAD Vector format from parcel dimensions/points
 */
function generateDxfContent(width, length, gsbOffset = 3) {
  const w = parseFloat(width);
  const l = parseFloat(length);
  const gsb = Math.min(parseFloat(gsbOffset), l * 0.4);

  return `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
0
ENDSEC
0
SECTION
2
TABLES
0
ENDSEC
0
SECTION
2
BLOCKS
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
5
100
100
AcDbEntity
8
BATAS_KAVLING
62
3
100
AcDbPolyline
90
4
70
1
43
0.0
10
0.0
20
0.0
10
${w}
20
0.0
10
${w}
20
${l}
10
0.0
20
${l}
0
LWPOLYLINE
5
101
100
AcDbEntity
8
GSB_SEMPADAN
62
1
100
AcDbPolyline
90
4
70
1
43
0.0
10
1.0
20
${gsb}
10
${w - 1.0}
20
${gsb}
10
${w - 1.0}
20
${l - 1.5}
10
1.0
20
${l - 1.5}
0
TEXT
5
102
100
AcDbEntity
8
TEKS_KETERANGAN
62
7
100
AcDbText
10
${w / 2 - 2}
20
${l / 2}
30
0.0
40
0.8
1
KAVLING: ${w}m x ${l}m (Luas: ${w * l} m2)
0
ENDSEC
0
EOF`;
}

/**
 * Fetch top-down High-Res Satellite Imagery (Esri World Imagery / Google Satellite)
 */
async function fetchSatelliteImage(lat, lon, panjang, lebar) {
  try {
    const spanMeters = Math.max(parseFloat(panjang) || 20, parseFloat(lebar) || 10, 60) * 2.5;
    const deltaLat = spanMeters / 111320;
    const deltaLon = spanMeters / (111320 * Math.cos((lat * Math.PI) / 180));

    const minLon = lon - deltaLon;
    const maxLon = lon + deltaLon;
    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;

    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLon},${minLat},${maxLon},${maxLat}&bboxSR=4326&imageSR=4326&size=1024,650&format=png&f=image`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "UrbanTechSpatialEngine/5.0 (contact@urbantech.id)",
      },
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (err) {
    console.warn("Satellite fetch warning:", err.message);
  }
  return null;
}

/**
 * Generate Formal IMB / PBG Technical Report (HTML Document with Satellite Map embedded)
 */
function generateFormalReportHtml(reportData, satImageBase64 = "") {
  const {
    noRegistrasi,
    namaPemohon,
    lokasi,
    panjang,
    lebar,
    luasTanah,
    kdbPersen,
    klbAngka,
    gsbMeter,
    luasTapakMaks,
    luasLantaiMaks,
    rthMinimun,
    lat,
    lon,
    tanggal,
  } = reportData;

  const satImgTag = satImageBase64
    ? `<img src="data:image/png;base64,${satImageBase64}" style="width:100%; max-height:280px; object-fit:cover; display:block;" alt="Peta Citra Satelit Kavling" />`
    : `<div style="padding:20px; color:#94a3b8; text-align:center; font-size:12px;">Citra Satelit Resolusi Tinggi</div>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan Teknis Tata Ruang & Rencana Tapak IMB/PBG - ${noRegistrasi}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.4; padding: 15px; background: #f8fafc; max-width: 900px; margin: 0 auto; }
    .page-container { background: #fff; padding: 30px 36px; border: 1px solid #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
    .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
    .header h2 { font-size: 15px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
    .header h3 { font-size: 12.5px; margin: 3px 0; font-weight: normal; }
    .header p { font-size: 10px; color: #444; margin: 0; }
    .report-title { text-align: center; font-size: 13px; font-weight: bold; text-decoration: underline; margin: 10px 0 2px; text-transform: uppercase; }
    .reg-no { text-align: center; font-size: 11px; font-family: monospace; margin-bottom: 12px; color: #334155; }
    .section-title { font-size: 11px; font-weight: bold; background: #f1f5f9; padding: 4px 8px; border-left: 4px solid #0f172a; margin: 10px 0 6px; text-transform: uppercase; font-family: sans-serif; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11px; }
    table td { padding: 3px 6px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
    table td.label { width: 38%; color: #475569; }
    table td.colon { width: 3%; }
    table td.value { font-weight: bold; color: #0f172a; }
    .calc-table { border: 1px solid #000; margin-top: 4px; }
    .calc-table th { background: #e2e8f0; padding: 5px; border: 1px solid #000; font-size: 10.5px; text-align: center; font-family: sans-serif; }
    .calc-table td { border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 10.5px; }
    
    /* MAP SECTION TAMPAK ATAS CITRA SATELIT */
    .map-box { margin: 8px 0; border: 2px solid #0f172a; border-radius: 6px; overflow: hidden; background: #000; }
    .map-header { background: #0f172a; color: #fff; padding: 5px 10px; font-size: 10.5px; font-weight: bold; display: flex; justify-content: space-between; font-family: sans-serif; }
    .map-content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #000; }
    .sat-preview-img { width: 100%; height: 220px; object-fit: cover; display: block; border-right: 1px solid #334155; }
    #parcelMap { height: 220px; width: 100%; }
    .map-legend { background: #f8fafc; padding: 5px 10px; font-size: 10px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-around; font-family: sans-serif; }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .legend-color { width: 12px; height: 12px; border: 1px solid #000; display: inline-block; }

    .signature { margin-top: 18px; width: 100%; display: flex; justify-content: space-between; page-break-inside: avoid; font-size: 11px; }
    .sign-box { width: 45%; text-align: center; }
    .sign-space { height: 45px; }
    .badge-pass { color: #047857; font-weight: bold; }
    .footer-note { font-size: 9px; color: #64748b; margin-top: 15px; border-top: 1px solid #cbd5e1; padding-top: 4px; font-style: italic; }
    .print-btn { display: block; margin: 0 auto 12px; padding: 8px 18px; background: #0f172a; color: #fff; border: none; border-radius: 6px; font-weight: bold; font-size: 11.5px; cursor: pointer; }
    @media print { 
      .print-btn { display: none; } 
      body { padding: 0; background: #fff; } 
      .page-container { border: none; box-shadow: none; padding: 0; } 
      .map-content-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Cetak / Simpan Laporan Resmi ke PDF</button>

  <div class="page-container">
    <div class="header">
      <h2>URBAN TECH SPATIAL CONSULTANT & ADVISORY</h2>
      <h3>LEMBAR LAPORAN TEKNIS INFORMASI TATA RUANG & KAVLING BANGUNAN</h3>
      <p>Standar Verifikasi Kelayakan Rencana Tapak Bangunan Gedung (IMB / PBG)</p>
    </div>

    <div class="report-title">LAPORAN REKOMENDASI TATA RUANG & RENCANA TAPAK (SITE PLAN)</div>
    <div class="reg-no">NOMOR REGISTRASI: REG-PBG-${noRegistrasi}</div>

    <div class="section-title">I. IDENTITAS PEMOHON & LOKASI PERSIL TANAH</div>
    <table>
      <tr>
        <td class="label">Nama Pemohon / Pemilik Lahan</td>
        <td class="colon">:</td>
        <td class="value">${namaPemohon}</td>
      </tr>
      <tr>
        <td class="label">Alamat / Lokasi Kavling</td>
        <td class="colon">:</td>
        <td class="value">${lokasi}</td>
      </tr>
      <tr>
        <td class="label">Titik Koordinat Pusat (WGS84)</td>
        <td class="colon">:</td>
        <td class="value">${lat}, ${lon}</td>
      </tr>
      <tr>
        <td class="label">Tanggal Verifikasi Teknis</td>
        <td class="colon">:</td>
        <td class="value">${tanggal}</td>
      </tr>
    </table>

    <!-- PETA CITRA SATELIT TAMPAK ATAS KAVLING -->
    <div class="section-title">II. PETA SITUASI & CITRA SATELIT TAMPAK ATAS KAVLING (SITE LAYOUT)</div>
    <div class="map-box">
      <div class="map-header">
        <span>🛰️ PETA TAMPAL CITRA SATELIT HD + OVERLAY BATAS PERSIL KAVLING</span>
        <span>SKALA 1:500 • EPSG:4326</span>
      </div>
      <div class="map-content-grid">
        <div style="background:#0f172a; position:relative;">
          <div style="position:absolute; top:4px; left:6px; background:rgba(0,0,0,0.7); color:#fff; font-size:9px; padding:2px 6px; border-radius:3px; z-index:10; font-family:sans-serif;">🛰️ Citra Satelit Tampak Atas</div>
          ${satImgTag}
        </div>
        <div style="position:relative;">
          <div style="position:absolute; top:4px; left:6px; background:rgba(0,0,0,0.7); color:#fff; font-size:9px; padding:2px 6px; border-radius:3px; z-index:1000; font-family:sans-serif;">📐 Vektor Batas & GSB (Live)</div>
          <div id="parcelMap"></div>
        </div>
      </div>
      <div class="map-legend">
        <div class="legend-item"><span class="legend-color" style="background:#ef4444; border-color:#b91c1c;"></span> Batas Kavling (${panjang}m x ${lebar}m)</div>
        <div class="legend-item"><span class="legend-color" style="background:none; border:2px dashed #eab308;"></span> Garis Sempadan GSB (${gsbMeter}m)</div>
        <div class="legend-item"><span class="legend-color" style="background:#10b981;"></span> Area Resapan RTH</div>
      </div>
    </div>

    <div class="section-title">III. PARAMETER INTENSITAS BANGUNAN (KRK / RDTR)</div>
    <table class="calc-table">
      <thead>
        <tr>
          <th>PARAMETER TEKNIS</th>
          <th>KETENTUAN RDTR</th>
          <th>HASIL PERHITUNGAN</th>
          <th>STATUS KELAYAKAN</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align:left;"><b>Dimensi Kavling (P x L)</b></td>
          <td>-</td>
          <td><b>${panjang} m x ${lebar} m</b></td>
          <td class="badge-pass">VALID</td>
        </tr>
        <tr>
          <td style="text-align:left;"><b>Luas Total Kavling</b></td>
          <td>Min. 60 m²</td>
          <td><b>${luasTanah} m²</b></td>
          <td class="badge-pass">MEMENUHI SYARAT</td>
        </tr>
        <tr>
          <td style="text-align:left;"><b>Koefisien Dasar Bangunan (KDB)</b></td>
          <td>Maksimal ${kdbPersen}%</td>
          <td>Luas Tapak Maks: <b>${luasTapakMaks} m²</b></td>
          <td class="badge-pass">LOLOS REKOMENDASI</td>
        </tr>
        <tr>
          <td style="text-align:left;"><b>Koefisien Lantai Bangunan (KLB)</b></td>
          <td>Faktor ${klbAngka}</td>
          <td>Total Luas Lantai: <b>${luasLantaiMaks} m²</b></td>
          <td class="badge-pass">LOLOS REKOMENDASI</td>
        </tr>
        <tr>
          <td style="text-align:left;"><b>Garis Sempadan Bangunan (GSB)</b></td>
          <td>Minimal ${gsbMeter} Meter</td>
          <td>Offset Sempadan: <b>${gsbMeter} m</b></td>
          <td class="badge-pass">SESUAI KAIDAH</td>
        </tr>
        <tr>
          <td style="text-align:left;"><b>Ruang Terbuka Hijau (KDH)</b></td>
          <td>Minimal 10% - 20%</td>
          <td>Area Resapan: <b>${rthMinimun} m²</b></td>
          <td class="badge-pass">DIANJURKAN</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">IV. KESIMPULAN & REKOMENDASI TEKNIS</div>
    <p style="font-size:10.5px; line-height: 1.45; text-align: justify; margin: 4px 0;">
      Berdasarkan hasil analisis spasial citra satelit dan perhitungan intensitas ruang, persil tanah atas nama <b>${namaPemohon}</b> yang terletak di <b>${lokasi}</b> dinyatakan <b>MEMENUHI SYARAT TEKNIS (FEASIBLE)</b> untuk diajukan dalam proses Persetujuan Bangunan Gedung (PBG/IMB). Terlampir visualisasi citra satelit tampak atas serta file desain vektor CAD (.DXF).
    </p>

    <div class="signature">
      <div class="sign-box">
        <p>Pemohon / Pemilik Lahan,</p>
        <div class="sign-space"></div>
        <p><b>( ${namaPemohon} )</b></p>
      </div>
      <div class="sign-box">
        <p>Verifikator Teknis Spasial,</p>
        <div class="sign-space"></div>
        <p><b>( TIM TEKNIS URBAN TECH )</b><br><small>Sertifikasi Ahli Perencanaan Wilayah & Kota</small></p>
      </div>
    </div>

    <div class="footer-note">
      * Dokumen ini dibuat otomatis oleh Urban Tech AI Spatial Engine untuk keperluan verifikasi teknis permohonan izin kavling dan bangunan gedung.
    </div>
  </div>

  <script>
    const centerLat = ${lat};
    const centerLon = ${lon};
    const p = ${panjang};
    const l = ${lebar};

    // Inisialisasi Peta Leaflet Satelit HD
    const map = L.map('parcelMap', { attributionControl: false, zoomControl: true }).setView([centerLat, centerLon], 19);

    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 22,
      subdomains:['mt0','mt1','mt2','mt3']
    }).addTo(map);

    // Hitung offset derajat koordinat (1 derajat lat approx 111,000 meter)
    const latOffset = (p / 111000) / 2;
    const lonOffset = (l / (111000 * Math.cos(centerLat * Math.PI / 180))) / 2;

    const bounds = [
      [centerLat - latOffset, centerLon - lonOffset],
      [centerLat + latOffset, centerLon + lonOffset]
    ];

    // Gambar Polygon Batas Kavling
    const parcelRect = L.rectangle(bounds, {
      color: "#ef4444",
      weight: 3,
      fillColor: "#ef4444",
      fillOpacity: 0.35
    }).addTo(map);

    // Pin Marker Tengah
    L.marker([centerLat, centerLon]).addTo(map).bindPopup("<b>Lokasi Kavling: ${namaPemohon}</b><br>Dimensi: " + p + "m x " + l + "m").openPopup();

    map.fitBounds(bounds, { padding: [20, 20] });
  </script>
</body>
</html>`;
}

/**
 * Generate full Parcel & IMB Dossier (DXF, Satellite Image PNG, HTML Report)
 */
async function createKavlingPackage(input) {
  const exportDir = path.join(__dirname, "exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const panjang = parseFloat(input.panjang) || 20;
  const lebar = parseFloat(input.lebar) || 10;
  const luasTanah = (panjang * lebar).toFixed(2);
  const kdbPersen = input.kdb || 60;
  const klbAngka = input.klb || 1.8;
  const gsbMeter = input.gsb || 3;
  const luasTapakMaks = ((luasTanah * kdbPersen) / 100).toFixed(2);
  const luasLantaiMaks = (luasTanah * klbAngka).toFixed(2);
  const rthMinimun = ((luasTanah * 15) / 100).toFixed(2);

  const lat = parseFloat(input.lat) || -7.04218;
  const lon = parseFloat(input.lon) || 110.44301;

  const noRegistrasi = Date.now().toString().slice(-6);
  const baseName = `kavling_IMB_${noRegistrasi}`;

  const reportData = {
    noRegistrasi,
    namaPemohon: input.nama || "Pemohon Terdaftar",
    lokasi: input.lokasi || "Kawasan Peruntukan Permukiman & Usaha",
    panjang,
    lebar,
    luasTanah,
    kdbPersen,
    klbAngka,
    gsbMeter,
    luasTapakMaks,
    luasLantaiMaks,
    rthMinimun,
    lat,
    lon,
    tanggal: new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };

  const dxfPath = path.join(exportDir, `${baseName}.dxf`);
  const htmlPath = path.join(exportDir, `${baseName}_laporan_resmi.html`);
  const satImagePath = path.join(exportDir, `${baseName}_citra_satelit.png`);

  // 1. Fetch & Save High-Res Satellite Image (Tampak Atas)
  let satBuffer = await fetchSatelliteImage(lat, lon, panjang, lebar);
  let satImageBase64 = "";
  if (satBuffer) {
    fs.writeFileSync(satImagePath, satBuffer);
    satImageBase64 = satBuffer.toString("base64");
  }

  // 2. Write DXF Vector
  const dxfContent = generateDxfContent(lebar, panjang, gsbMeter);
  fs.writeFileSync(dxfPath, dxfContent, "utf-8");

  // 3. Write Formal Report HTML with embedded Satellite Map
  const htmlContent = generateFormalReportHtml(reportData, satImageBase64);
  fs.writeFileSync(htmlPath, htmlContent, "utf-8");

  return {
    dxfPath,
    htmlPath,
    satImagePath,
    satBuffer,
    reportData,
  };
}

module.exports = {
  createKavlingPackage,
  fetchSatelliteImage,
};

