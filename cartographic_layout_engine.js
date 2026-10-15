const { createCanvas, loadImage } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");
const { lonLatToMercator } = require("./raster_engine");

/**
 * Categorized vs Graduated vs Interval Symbology Specifications
 * All 23 tools in TOOLS_REGISTRY have explicit academic cartographic styling.
 */
const SYMBOLOGY_REGISTRY = {
  // --- 1. CITRA SATELIT & SPEKTRAL ---
  sentinel2: {
    type: "categorized",
    title: "Sentinel-2 L2A Multispektral",
    items: [
      { color: "#2d6a4f", label: "Kanopi Hutan Primer / RTH Rapat" },
      { color: "#588157", label: "Pertanian / Sawah / Lahan Basah" },
      { color: "#c17c54", label: "Kawasan Permukiman & Terbangun" },
      { color: "#e9c46a", label: "Tanah Terbuka / Pasir / Semak" },
      { color: "#1d3557", label: "Badan Air / Danau / Pesisir" },
    ],
  },
  landsat: {
    type: "categorized",
    title: "Landsat 8/9 OLI True Color",
    items: [
      { color: "#1b4332", label: "Hutan Tropis / RTH Alami" },
      { color: "#52b788", label: "Lahan Pertanian & Perkebunan" },
      { color: "#d97706", label: "Kawasan Bangunan & Infrastruktur" },
      { color: "#f59e0b", label: "Lahan Terbuka / Pasir" },
      { color: "#023e8a", label: "Perairan / Muara / Waduk" },
    ],
  },
  radar: {
    type: "graduated",
    title: "ALOS PALSAR SAR Backscatter (dB)",
    unit: "dB",
    stops: [
      { offset: 0.0, color: "#000000" },
      { offset: 0.25, color: "#334155" },
      { offset: 0.5, color: "#64748b" },
      { offset: 0.75, color: "#cbd5e1" },
      { offset: 1.0, color: "#ffffff" },
    ],
    ticks: ["-25 dB", "-20 dB", "-15 dB", "-10 dB", "-5 dB", "0 dB"],
  },
  satellite_rgb: {
    type: "categorized",
    title: "True Color Satellite RGB",
    items: [
      { color: "#2d6a4f", label: "Vegetasi Rapat / Hutan" },
      { color: "#74c69d", label: "Vegetasi Rendah / Rumput" },
      { color: "#e76f51", label: "Kawasan Terbangun" },
      { color: "#e9c46a", label: "Tanah Terbuka / Batuan" },
      { color: "#1d3557", label: "Badan Air Permukaan" },
    ],
  },
  ndvi: {
    type: "graduated",
    title: "NDVI (Kerapatan Vegetasi)",
    unit: "",
    stops: [
      { offset: 0.0, color: "#8b4513" },
      { offset: 0.25, color: "#e6c832" },
      { offset: 0.5, color: "#82c832" },
      { offset: 0.75, color: "#28a03c" },
      { offset: 1.0, color: "#0a5a1e" },
    ],
    ticks: ["-0.2 (Air/Batu)", "0.0", "0.2 (Jarang)", "0.4 (Sedang)", "0.6", "0.8 (Sangat Rapat)"],
  },
  ndbi: {
    type: "categorized",
    title: "Kepadatan Lahan Terbangun (NDBI)",
    items: [
      { color: "#0a2d6e", label: "Badan Air / Non-Urban" },
      { color: "#1e823c", label: "Vegetasi / RTH / Kebun" },
      { color: "#dcc85a", label: "Kawasan Campuran Rendah" },
      { color: "#f58c23", label: "Permukiman Sedang" },
      { color: "#e11e32", label: "Pusat Urban Sangat Padat" },
    ],
  },
  landcover: {
    type: "categorized",
    title: "ESA WorldCover (10m)",
    items: [
      { color: "#0077b6", label: "Badan Air / Pesisir" },
      { color: "#2d6a4f", label: "Hutan Primer / Kanopi Rapat" },
      { color: "#a7c957", label: "Pertanian / Sawah" },
      { color: "#e9c46a", label: "Semak Belukar / Belukar" },
      { color: "#f4a261", label: "Tanah Terbuka / Lahan Kosong" },
      { color: "#e63946", label: "Kawasan Terbangun / Permukiman" },
    ],
  },

  // --- 2. TOPOGRAFI & ELEVASI 3D ---
  dem: {
    type: "graduated",
    title: "Elevasi MDPL Topografi (m)",
    unit: "m",
    stops: [
      { offset: 0.0, color: "#2d6a4f" },
      { offset: 0.2, color: "#74c69d" },
      { offset: 0.4, color: "#ffd166" },
      { offset: 0.7, color: "#f4a261" },
      { offset: 1.0, color: "#e76f51" },
    ],
    ticks: ["0 m (Pesisir)", "50 m", "150 m", "300 m", "600 m", ">1.200 m (Puncak)"],
  },
  dsm: {
    type: "graduated",
    title: "DSM Surface Elevation (m)",
    unit: "m",
    stops: [
      { offset: 0.0, color: "#264653" },
      { offset: 0.3, color: "#2a9d8f" },
      { offset: 0.6, color: "#e9c46a" },
      { offset: 1.0, color: "#e76f51" },
    ],
    ticks: ["0 m", "25 m", "75 m", "150 m", ">300 m"],
  },
  hillshade: {
    type: "graduated",
    title: "3D Relief Hillshade",
    unit: "DN",
    stops: [
      { offset: 0.0, color: "#0f172a" },
      { offset: 0.35, color: "#475569" },
      { offset: 0.65, color: "#94a3b8" },
      { offset: 1.0, color: "#f8fafc" },
    ],
    ticks: ["0 (Bayangan)", "64", "128 (Netral)", "192", "255 (Pencahayaan Penuh)"],
  },

  // --- 3. PEMODELAN SPASIAL & KEBENCANAAN ---
  slope: {
    type: "interval",
    title: "Kemiringan Lereng (%) — SNI PU",
    items: [
      { color: "#2d6a4f", label: "0 - 8% (Datar / Dataran Rendah)" },
      { color: "#a7c957", label: "8 - 15% (Landai / Bergelombang)" },
      { color: "#e9c46a", label: "15 - 25% (Agak Curam)" },
      { color: "#e76f51", label: "25 - 45% (Curam)" },
      { color: "#b5179e", label: "> 45% (Sangat Curam / Lindung)" },
    ],
  },
  hydro: {
    type: "categorized",
    title: "Arah Aliran & Jaringan Drainase (D8)",
    items: [
      { color: "#03045e", label: "Sungai Utama / Orde 4-5 (Aliran Primer)" },
      { color: "#0077b6", label: "Anak Sungai / Drainase Utama (Orde 3)" },
      { color: "#00b4d8", label: "Saluran Sekunder / Runoff (Orde 2)" },
      { color: "#90e0ef", label: "Limpasan Aliran Hulu (Orde 1)" },
      { color: "#64748b", label: "Batas Daerah Aliran Sungai (DAS)" },
    ],
  },
  hazard: {
    type: "categorized",
    title: "Zonasi Risiko Bencana (InaRISK/USGS)",
    items: [
      { color: "#2d6a4f", label: "Zona Kerentanan Rendah / Stabil" },
      { color: "#0077b6", label: "Zona Rawan Genangan / Banjir Rob" },
      { color: "#e76f51", label: "Zona Bahaya Longsor Sedang" },
      { color: "#e63946", label: "Zona Bahaya Tinggi (Gerakan Tanah)" },
      { color: "#7209b7", label: "Zona Bahaya Ekstrem (Multi-Hazard)" },
    ],
  },
  lst: {
    type: "graduated",
    title: "Suhu Permukaan Lahan LST (°C)",
    unit: "°C",
    stops: [
      { offset: 0.0, color: "#1e50c8" },
      { offset: 0.25, color: "#46b478" },
      { offset: 0.5, color: "#fad232" },
      { offset: 0.75, color: "#f0781e" },
      { offset: 1.0, color: "#dc143c" },
    ],
    ticks: ["20°C (Sejuk)", "24°C", "28°C", "32°C", "36°C", "40°C (Urban Heat)"],
  },

  // --- 4. DATA GLOBAL, IKLIM & LULC ---
  dw: {
    type: "categorized",
    title: "Dynamic World (LULC 10m Near-Real-Time)",
    items: [
      { color: "#0077b6", label: "Water (Badan Air)" },
      { color: "#2d6a4f", label: "Trees (Pohon/Hutan)" },
      { color: "#a7c957", label: "Grass (Rerumputan)" },
      { color: "#f4a261", label: "Flooded Vegetation" },
      { color: "#ffd166", label: "Crops (Pertanian)" },
      { color: "#e9c46a", label: "Shrub & Scrub" },
      { color: "#e63946", label: "Built Area (Terbangun)" },
      { color: "#9ca3af", label: "Bare Ground (Tanah Terbuka)" },
    ],
  },
  esri: {
    type: "categorized",
    title: "ESRI Multi-Year Land Cover 10m",
    items: [
      { color: "#0077b6", label: "Water (Air)" },
      { color: "#2d6a4f", label: "Trees / Forest (Hutan)" },
      { color: "#a7c957", label: "Crops (Sawah/Kebun)" },
      { color: "#e9c46a", label: "Rangeland (Semak)" },
      { color: "#e63946", label: "Built Area (Permukiman)" },
      { color: "#f4a261", label: "Bare Ground (Lahan Kosong)" },
    ],
  },
  pop: {
    type: "graduated",
    title: "Kepadatan Penduduk (WorldPop 100m)",
    unit: "jiwa",
    stops: [
      { offset: 0.0, color: "#ffffcc" },
      { offset: 0.3, color: "#a1dab4" },
      { offset: 0.6, color: "#41b6c4" },
      { offset: 0.85, color: "#225ea8" },
      { offset: 1.0, color: "#081d58" },
    ],
    ticks: ["0 jiwa", "50", "200", "500", "1.500", ">3.000 jiwa/100m"],
  },
  viirs: {
    type: "graduated",
    title: "Emisi Cahaya Malam (NASA/NOAA VIIRS)",
    unit: "nW",
    stops: [
      { offset: 0.0, color: "#000000" },
      { offset: 0.3, color: "#311054" },
      { offset: 0.6, color: "#9c179e" },
      { offset: 0.85, color: "#f8765c" },
      { offset: 1.0, color: "#fcfdbf" },
    ],
    ticks: ["0 (Gelap/Pedesaan)", "5", "15", "35", "75", ">150 nW/cm² (Metropolis)"],
  },
  ghsl: {
    type: "categorized",
    title: "Kronologi Pertumbuhan Kota (GHSL Epoch)",
    items: [
      { color: "#800026", label: "Era 1975 - 1990 (Pusat Kota Lama)" },
      { color: "#e31a1c", label: "Era 1990 - 2000 (Ekspansi 90-an)" },
      { color: "#fd8d3c", label: "Era 2000 - 2014 (Sub-urban Baru)" },
      { color: "#fecc5c", label: "Era 2014 - 2024 (Ekspansi Mutakhir)" },
      { color: "#0077b6", label: "Badan Air / Kawasan Non-Urban" },
    ],
  },
  forest: {
    type: "graduated",
    title: "Tutupan Kanopi Hutan (GFW Hansen)",
    unit: "%",
    stops: [
      { offset: 0.0, color: "#f7fcf5" },
      { offset: 0.25, color: "#c7e9c0" },
      { offset: 0.5, color: "#74c476" },
      { offset: 0.75, color: "#238b45" },
      { offset: 1.0, color: "#00441b" },
    ],
    ticks: ["0% (Terbuka)", "20%", "40%", "60%", "80%", "100% (Kanopi Primer)"],
  },
  s5p: {
    type: "graduated",
    title: "Konsentrasi Polusi NO2 (Sentinel-5P)",
    unit: "µmol",
    stops: [
      { offset: 0.0, color: "#2c7bb6" },
      { offset: 0.3, color: "#abd9e9" },
      { offset: 0.6, color: "#ffffbf" },
      { offset: 0.85, color: "#fdae61" },
      { offset: 1.0, color: "#d7191c" },
    ],
    ticks: ["0 µmol/m² (Bersih)", "25", "50", "100", "200", ">350 (Polutif)"],
  },
  rain: {
    type: "graduated",
    title: "Presipitasi Curah Hujan Tahunan",
    unit: "mm",
    stops: [
      { offset: 0.0, color: "#f7fbff" },
      { offset: 0.25, color: "#c6dbef" },
      { offset: 0.5, color: "#6baed6" },
      { offset: 0.75, color: "#2171b5" },
      { offset: 1.0, color: "#08306b" },
    ],
    ticks: ["500 mm", "1.000 mm", "1.500 mm", "2.200 mm", "3.000 mm", ">4.000 mm"],
  },
  solar: {
    type: "graduated",
    title: "Potensi Radiasi Surya (Global Solar)",
    unit: "kWh",
    stops: [
      { offset: 0.0, color: "#440154" },
      { offset: 0.25, color: "#3b528b" },
      { offset: 0.5, color: "#21908c" },
      { offset: 0.75, color: "#5dc863" },
      { offset: 1.0, color: "#fde725" },
    ],
    ticks: ["3.0 kWh/m²", "3.5", "4.0", "4.5", "5.0", ">5.5 kWh/m²"],
  },

  // --- 5. GEOPORTAL RESMI INDONESIA ---
  rbi_big: {
    type: "categorized",
    title: "Peta RBI Skala 1:25.000 (BIG)",
    items: [
      { color: "#2b8a3e", label: "Tutupan Vegetasi & Kebun" },
      { color: "#e03131", label: "Permukiman & Bangunan" },
      { color: "#1971c2", label: "Garis Pantai & Sungai" },
      { color: "#f08c00", label: "Jaringan Transportasi & Jalan" },
      { color: "#868e96", label: "Batas Administrasi Wilayah" },
    ],
  },
  gistaru_atr: {
    type: "categorized",
    title: "Pola Ruang RTRW / RDTR (ATR/BPN)",
    items: [
      { color: "#2b8a3e", label: "Kawasan Lindung / RTH" },
      { color: "#fab005", label: "Kawasan Budidaya Pertanian" },
      { color: "#e03131", label: "Kawasan Perumahan & Komersial" },
      { color: "#7950f2", label: "Kawasan Peruntukan Industri" },
      { color: "#1971c2", label: "Sempadan Sungai / Danau" },
    ],
  },
  inarisk_bnpb: {
    type: "categorized",
    title: "Indeks Bahaya Bencana InaRISK",
    items: [
      { color: "#51cf66", label: "Kelas Bahaya Rendah" },
      { color: "#fcc419", label: "Kelas Bahaya Sedang" },
      { color: "#ff6b6b", label: "Kelas Bahaya Tinggi" },
    ],
  },
  esdm_geologi: {
    type: "categorized",
    title: "Geologi & Kerentanan Vulkanik",
    items: [
      { color: "#845ef7", label: "Formasi Batuan Sedimen" },
      { color: "#ff922b", label: "Batuan Vulkanik Kuarter" },
      { color: "#e03131", label: "Zona Sesar / Patahan Aktif" },
      { color: "#20c997", label: "Aluvium Dataran Pantai" },
    ],
  },
  klhk_hutan: {
    type: "categorized",
    title: "Status Kawasan Hutan (KLHK)",
    items: [
      { color: "#2b8a3e", label: "Hutan Lindung (HL)" },
      { color: "#5c940d", label: "Hutan Produksi Tetap (HP)" },
      { color: "#94d82d", label: "Hutan Produksi Terbatas (HPT)" },
      { color: "#e67700", label: "Hutan Produksi Konversi (HPK)" },
      { color: "#1098ad", label: "Kawasan Suaka Alam / Konservasi" },
      { color: "#868e96", label: "Areal Penggunaan Lain (APL)" },
    ],
  },
};

/**
 * Fetch Background Satellite Imagery for Basemap Overlay Context
 */
async function fetchBasemapBuffer(bbox, width = 820, height = 760) {
  const minMeters = lonLatToMercator(bbox.minLon, bbox.minLat);
  const maxMeters = lonLatToMercator(bbox.maxLon, bbox.maxLat);
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minMeters.x},${minMeters.y},${maxMeters.x},${maxMeters.y}&bboxSR=3857&imageSR=3857&size=${width},${height}&format=png&f=image`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": "UrbanTechSpatialPlot/5.0" } });
    if (res.ok) {
      const arr = await res.arrayBuffer();
      return Buffer.from(arr);
    }
  } catch (e) {}
  return null;
}

/**
 * Calculate nice round kilometer number for scalebar
 */
function getNiceScaleDistance(spanKm) {
  const target = spanKm * 0.28; // ~28% of map width
  const exponent = Math.floor(Math.log10(target));
  const fraction = target / Math.pow(10, exponent);
  let niceFraction = 1;
  if (fraction >= 7.5) niceFraction = 10;
  else if (fraction >= 3.5) niceFraction = 5;
  else if (fraction >= 1.75) niceFraction = 2;
  else niceFraction = 1;
  return Math.max(1, niceFraction * Math.pow(10, exponent));
}

/**
 * Draws a Combined Inset Badge in Bottom-Right:
 * Includes both the North Arrow (Orientasi Utara) and Double Zebra Scale Bar!
 */
function drawBottomRightBadge(ctx, axX, axY, axW, axH, bbox) {
  ctx.save();

  // Calculate actual geographic span across map width in km
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const spanKm = Math.max(0.5, (bbox.maxLon - bbox.minLon) * 111.32 * Math.cos((midLat * Math.PI) / 180));
  const niceKm = getNiceScaleDistance(spanKm);
  const scaleBarPixels = Math.max(120, Math.min(180, Math.round((niceKm / spanKm) * axW)));

  const badgeW = scaleBarPixels + 80;
  const badgeH = 76;
  const badgeX = axX + axW - badgeW - 14;
  const badgeY = axY + axH - badgeH - 14;

  // 1. Semi-transparent Cartographic Card Frame
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fill();
  ctx.stroke();

  // Subtle inner accent
  ctx.strokeStyle = "rgba(15, 23, 42, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(badgeX + 3, badgeY + 3, badgeW - 6, badgeH - 6, 4);
  ctx.stroke();

  // 2. North Arrow (Left side of badge)
  const compassX = badgeX + 32;
  const compassY = badgeY + 40;
  const compassSize = 22;

  // Outer Compass Ring
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(compassX, compassY, compassSize * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  // North Arrow Left Needle (Black)
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.moveTo(compassX, compassY - compassSize);
  ctx.lineTo(compassX - compassSize * 0.35, compassY);
  ctx.lineTo(compassX, compassY + compassSize * 0.22);
  ctx.closePath();
  ctx.fill();

  // North Arrow Right Needle (White)
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(compassX, compassY - compassSize);
  ctx.lineTo(compassX + compassSize * 0.35, compassY);
  ctx.lineTo(compassX, compassY + compassSize * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // "U" Label on top of compass
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("U", compassX, compassY - compassSize - 2);

  // 3. Double Zebra Scale Bar (Right side of badge)
  const sbX = badgeX + 68;
  const sbY = badgeY + 35;
  const segW = scaleBarPixels / 4; // 4 alternating zebra segments
  const rowH = 4.5; // Double tier height (9px total)

  // Top Row (Tier 1): Black | White | Black | White
  for (let s = 0; s < 4; s++) {
    ctx.fillStyle = s % 2 === 0 ? "#0f172a" : "#ffffff";
    ctx.fillRect(sbX + s * segW, sbY, segW, rowH);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1;
    ctx.strokeRect(sbX + s * segW, sbY, segW, rowH);
  }

  // Bottom Row (Tier 2): White | Black | White | Black
  for (let s = 0; s < 4; s++) {
    ctx.fillStyle = s % 2 === 1 ? "#0f172a" : "#ffffff";
    ctx.fillRect(sbX + s * segW, sbY + rowH, segW, rowH);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1;
    ctx.strokeRect(sbX + s * segW, sbY + rowH, segW, rowH);
  }

  // Double Zebra Outer Border
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.4;
  ctx.strokeRect(sbX, sbY, scaleBarPixels, rowH * 2);

  // Scale Bar Numbers (0, Mid, Max km)
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("0", sbX, sbY - 4);
  ctx.fillText(`${(niceKm / 2).toLocaleString("id-ID")}`, sbX + scaleBarPixels / 2, sbY - 4);
  ctx.fillText(`${niceKm.toLocaleString("id-ID")} km`, sbX + scaleBarPixels, sbY - 4);

  // Bottom Descriptor
  ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.textAlign = "center";
  ctx.fillText("SKALA GRAFIK (KM)", sbX + scaleBarPixels / 2, sbY + rowH * 2 + 15);

  ctx.restore();
}

/**
 * Generates Academic Cartographic Map with Strict Categorized / Graduated / Interval Legend Styles
 */
async function generateCartographicLayoutMap(options) {
  const {
    rawImagePath,
    toolId,
    toolName,
    regionName,
    bbox,
    utm,
    geoArea,
    outputPath,
  } = options;

  const rawImg = await loadImage(rawImagePath);
  const symConfig = SYMBOLOGY_REGISTRY[toolId] || SYMBOLOGY_REGISTRY.ndvi;

  // Standard HD Cartographic Canvas: 1240 x 920
  const canvasW = 1240;
  const canvasH = 920;
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  // Pure White Academic Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 1. Map Axes Coordinates Area
  const axX = 110;
  const axY = 80;
  const axW = 800;
  const axH = 750;

  // 2. Title & Cartographic Metadata Header
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "left";
  const displayTitle = `${toolName || "Spatial Engine Map"} — ${regionName || "Study Area"}`;
  ctx.fillText(displayTitle, axX, axY - 30);

  ctx.fillStyle = "#475569";
  ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(
    `CRS: ${utm?.name || "WGS 84 / Web Mercator (EPSG:3857)"} | Luas Wilayah: ${geoArea?.areaHa ? geoArea.areaHa.toLocaleString("id-ID") + " ha" : "~"}`,
    axX,
    axY - 10
  );

  // 3. Draw Satellite Context Basemap
  const satBuffer = await fetchBasemapBuffer(bbox, axW, axH);
  if (satBuffer) {
    try {
      const satImg = await loadImage(satBuffer);
      ctx.save();
      ctx.drawImage(satImg, axX, axY, axW, axH);
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)"; // slight veil for contrast
      ctx.fillRect(axX, axY, axW, axH);
      ctx.restore();
    } catch (e) {}
  } else {
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(axX, axY, axW, axH);
  }

  // 4. Draw Clipped Thematic Raster
  ctx.drawImage(rawImg, axX, axY, axW, axH);

  // 5. Combined In-Map Bottom-Right Badge (Orientasi Utara + Double Zebra Scale Bar)
  drawBottomRightBadge(ctx, axX, axY, axW, axH, bbox);

  // 6. Draw Axes Frame Border
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.6;
  ctx.strokeRect(axX, axY, axW, axH);

  // 7. Draw Axes Ticks & Coordinate Values (Enlarged & Crisp Font)
  const numXTicks = 5;
  const numYTicks = 6;
  const tickLen = 8;

  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.4;

  // X-Axis (Bottom) Ticks & Longitude Values
  ctx.textAlign = "center";
  for (let i = 0; i < numXTicks; i++) {
    const x = axX + (axW / (numXTicks - 1)) * i;
    const lonVal = bbox.minLon + ((bbox.maxLon - bbox.minLon) / (numXTicks - 1)) * i;

    ctx.beginPath();
    ctx.moveTo(x, axY + axH);
    ctx.lineTo(x, axY + axH + tickLen);
    ctx.stroke();

    ctx.fillText(lonVal.toFixed(2) + "°", x, axY + axH + 26);
  }

  // Y-Axis (Left) Ticks & Latitude Values
  ctx.textAlign = "right";
  for (let i = 0; i < numYTicks; i++) {
    const y = axY + (axH / (numYTicks - 1)) * i;
    const latVal = bbox.maxLat - ((bbox.maxLat - bbox.minLat) / (numYTicks - 1)) * i;

    ctx.beginPath();
    ctx.moveTo(axX, y);
    ctx.lineTo(axX - tickLen, y);
    ctx.stroke();

    ctx.fillText(latVal.toFixed(2) + "°", axX - 12, y + 6);
  }

  // 8. RIGHT SIDEBAR LEGEND (STRICT CATEGORIZED VS GRADUATED)
  const rightX = axX + axW + 35;
  const rightW = canvasW - rightX - 25;

  // --- TYPE A: CATEGORIZED & INTERVAL (Kotak Swatch Warna Terpisah Satu-Satu) ---
  if (symConfig.type === "categorized" || symConfig.type === "interval") {
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(symConfig.title || "Keterangan Legenda", rightX, axY + 15);

    let curY = axY + 38;
    const items = symConfig.items || [];
    const boxSize = 20;

    items.forEach((item) => {
      // Swatch box
      ctx.fillStyle = item.color;
      ctx.fillRect(rightX, curY, boxSize, boxSize);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(rightX, curY, boxSize, boxSize);

      // Label text
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(item.label, rightX + boxSize + 10, curY + 15);

      curY += 32;
    });

    // Subtitle note
    ctx.fillStyle = "#64748b";
    ctx.font = "italic 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(
      symConfig.type === "interval" ? "Klasifikasi Interval Standar PU" : "Simbol Klasifikasi Diskrit",
      rightX,
      curY + 12
    );
  }
  // --- TYPE B: GRADUATED (Colorbar Gradasi Vertikal Berangka Presisi) ---
  else if (symConfig.type === "graduated") {
    const cbW = 28;
    const cbH = axH - 80;
    const cbY = axY + 45;

    // Title
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(symConfig.title || "Nilai Indeks", rightX, axY + 15);

    // Continuous Gradient Bar
    const grad = ctx.createLinearGradient(rightX, cbY, rightX, cbY + cbH);
    const stops = symConfig.stops || [];
    stops.forEach((s) => {
      grad.addColorStop(1 - s.offset, s.color);
    });

    ctx.fillStyle = grad;
    ctx.fillRect(rightX, cbY, cbW, cbH);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.3;
    ctx.strokeRect(rightX, cbY, cbW, cbH);

    // Colorbar Numeric Ticks
    const ticks = symConfig.ticks || [];
    ctx.textAlign = "left";
    ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace, sans-serif";

    for (let i = 0; i < ticks.length; i++) {
      const ty = cbY + cbH - (cbH / (ticks.length - 1)) * i;

      ctx.beginPath();
      ctx.moveTo(rightX + cbW, ty);
      ctx.lineTo(rightX + cbW + 6, ty);
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.fillText(ticks[i], rightX + cbW + 10, ty + 4);
    }
  }

  // Write finalized layout image
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);

  return {
    layoutPath: outputPath,
    buffer,
  };
}

module.exports = {
  generateCartographicLayoutMap,
  SYMBOLOGY_REGISTRY,
};

