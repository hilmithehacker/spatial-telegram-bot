const fs = require("fs");
const path = require("path");
const net = require("net");
const dotenv = require("dotenv");
const {
  resolveBoundingBox,
  searchLocationCandidates,
  generateUniversalGeoTIFF,
} = require("./raster_engine");
const {
  parseUploadedSpatialFile,
} = require("./polygon_engine");
const {
  generateSlopeAnalysis,
  generateHydrologyDrainage,
  generateMultiHazardAnalysis,
  generateLstThermalAnalysis,
} = require("./spatial_analysis_engine");
const {
  generateWorldPopDensity,
  generateViirsNightLights,
  generateGhslBuiltupEpoch,
  generateForestCanopyCover,
  generateSentinel5pAirQuality,
  generateChirpsRainfall,
  generateGlobalSolarAtlas,
  generateDynamicWorldLulc,
  generateEsriMultiYearLandCover,
} = require("./opensource_data_engine");
const {
  getIndonesianUtmZone,
  calculateGeodesicAreaHa,
} = require("./qml_styling_engine");
const {
  GEOPORTAL_SERVICES,
} = require("./geoportal_engine");
const {
  generateCartographicLayoutMap,
} = require("./cartographic_layout_engine");

dotenv.config();

const BOT_TOKEN = process.env.SPATIAL_BOT_TOKEN || "8993546612:AAES4kAKW102c2GC4jzFNKBISzgYSNlK_mY";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// State Management for active conversation sessions
const userSessions = new Map();

/**
 * Tool Registry Definitions
 */
const TOOLS_REGISTRY = {
  // 1. Citra Satelit & Spektral
  sentinel2: { name: "Sentinel-2 L2A Multispektral (10m)", cat: "sat", icon: "🛰️", desc: "Citra optik multispektral resolusi 10m bebas awan" },
  landsat: { name: "Landsat 8/9 OLI Multispektral (15m)", cat: "sat", icon: "🛰️", desc: "Citra satelit optik bumi resolusi 15m" },
  radar: { name: "ALOS PALSAR SAR Radar (12.5m)", cat: "sat", icon: "📡", desc: "Citra gelombang mikro radar penembus awan & kanopi" },
  satellite_rgb: { name: "Very High-Res Satellite RGB", cat: "sat", icon: "📷", desc: "Citra satelit komposit warna asli (True Color RGB)" },
  ndvi: { name: "NDVI (Indeks Kerapatan Vegetasi)", cat: "sat", icon: "🌿", desc: "Peta kehijauan & kerapatan kanopi vegetasi" },
  ndbi: { name: "NDBI (Indeks Kepadatan Bangunan)", cat: "sat", icon: "🏙️", desc: "Peta konsentrasi permukiman & kawasan terbangun" },
  landcover: { name: "Tutupan Lahan ESA WorldCover (10m)", cat: "sat", icon: "🗺️", desc: "Klasifikasi tutupan lahan global ESA" },

  // 2. Topografi & Elevasi 3D
  dem: { name: "DEM Topografi SRTM (30m)", cat: "topo", icon: "⛰️", desc: "Model elevasi digital elevasi permukaan tanah" },
  dsm: { name: "DSM ALOS AW3D30 Surface", cat: "topo", icon: "🏔️", desc: "Digital Surface Model kontur dan tutupan permukaan" },
  hillshade: { name: "Hillshade 3D Relief", cat: "topo", icon: "🗻", desc: "Peta bayangan relief 3D pencahayaan matahari" },

  // 3. Pemodelan Spasial & Kebencanaan
  slope: { name: "Analisis Kelerengan (Permen PU 5 Kelas)", cat: "analysis", icon: "📐", desc: "Klasifikasi kemiringan lereng standar tata ruang PU & SNI" },
  hydro: { name: "Arah Aliran Air & Drainase (D8 Hydrology)", cat: "analysis", icon: "🌊", desc: "Model akumulasi aliran air & jaringan sungai drainase" },
  hazard: { name: "Multi-Hazard InaRISK & USGS (Longsor/Banjir)", cat: "analysis", icon: "🚨", desc: "Zonasi kerentanan bencana geologis & hidrometeorologi" },
  lst: { name: "Suhu Permukaan Lahan & Heat Island (LST)", cat: "analysis", icon: "🌡️", desc: "Peta distribusi suhu termal & pulau panas perkotaan" },

  // 4. Data Global, Iklim & LULC
  dw: { name: "Dynamic World 10m (Google & WRI NRT)", cat: "opendata", icon: "🌍", desc: "Peta tutupan lahan 9 kelas near-real-time Google/WRI" },
  esri: { name: "ESRI 10m Multi-Year Land Cover (2017-2024)", cat: "opendata", icon: "🗺️", desc: "Peta time-series dinamika perubahan tutupan lahan ESRI" },
  pop: { name: "Kepadatan Penduduk (WorldPop 100m)", cat: "opendata", icon: "👥", desc: "Grid kepadatan populasi dan kluster demografi 100m" },
  viirs: { name: "Lampu Malam Satelit (NASA/NOAA VIIRS)", cat: "opendata", icon: "🌃", desc: "Peta emisi cahaya malam & indeks elektrifikasi ekonomi" },
  ghsl: { name: "Kronologi Pertumbuhan Kota (GHSL Epoch)", cat: "opendata", icon: "🏭", desc: "Sejarah pemekaran kawasan urban era 1975 hingga 2024" },
  forest: { name: "Tutupan Kanopi Hutan (GFW Hansen 30m)", cat: "opendata", icon: "🌲", desc: "Peta kerapatan hutan primer & stok serapan karbon" },
  s5p: { name: "Kualitas Udara & Polusi NO2 (Sentinel-5P)", cat: "opendata", icon: "🌬️", desc: "Peta konsentrasi gas polutan NO2 troposfer" },
  rain: { name: "Curah Hujan Historis & Isohyet (CHIRPS/ERA5)", cat: "opendata", icon: "🌧️", desc: "Peta isohyet presipitasi tahunan & tipe iklim" },
  solar: { name: "Potensi Energi Surya PLTS (Global Solar Atlas)", cat: "opendata", icon: "☀️", desc: "Analisis radiasi GHI & kelayakan pasang solar panel" },

  // 5. Geoportal Resmi Indonesia (WMS/WFS)
  rbi_big: { name: "Peta Rupabumi Indonesia (RBI 1:25.000)", cat: "geoportal", icon: "🏛️", desc: "Peta dasar topografi resmi Badan Informasi Geospasial (BIG)" },
  gistaru_atr: { name: "Pola Ruang RTRW & RDTR Legal", cat: "geoportal", icon: "🏛️", desc: "Peta zonasi tata ruang resmi Kementerian ATR/BPN" },
  inarisk_bnpb: { name: "InaRISK Peta Bahaya Bencana Nasional", cat: "geoportal", icon: "🚨", desc: "Layer resmi bahaya banjir, longsor, gempa, tsunami BNPB" },
  esdm_geologi: { name: "Peta Geologi & Bahaya Vulkanik ESDM", cat: "geoportal", icon: "🌋", desc: "Struktur batuan, patahan sesar aktif, & KRB Gunungapi" },
  klhk_hutan: { name: "Peta Kawasan Hutan & Konservasi KLHK", cat: "geoportal", icon: "🌲", desc: "Status Hutan Lindung, Hutan Produksi, & Kawasan Konservasi" },
};

/**
 * Send message to Telegram chat
 */
async function sendMessage(chatId, text, replyMarkup = null, parseMode = "HTML") {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error("Error sending Telegram message:", err);
  }
}

/**
 * Answer Callback Query
 */
async function answerCallbackQuery(callbackQueryId, text = "") {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
      }),
    });
  } catch (e) {}
}

/**
 * Send photo to Telegram chat with HTML-fallback protection
 */
async function sendPhoto(chatId, imageBuffer, caption = "", replyMarkup = null) {
  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
    formData.append(
      "photo",
      new Blob([imageBuffer], { type: "image/png" }),
      "preview.png"
    );
    if (replyMarkup) formData.append("reply_markup", JSON.stringify(replyMarkup));

    const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn("sendPhoto HTML error, retrying without HTML:", data.description);
      const fbForm = new FormData();
      fbForm.append("chat_id", chatId);
      fbForm.append("caption", caption.replace(/<[^>]*>/g, ""));
      fbForm.append("photo", new Blob([imageBuffer], { type: "image/png" }), "preview.png");
      if (replyMarkup) fbForm.append("reply_markup", JSON.stringify(replyMarkup));
      const fbRes = await fetch(`${TELEGRAM_API}/sendPhoto`, { method: "POST", body: fbForm });
      return await fbRes.json();
    }
    return data;
  } catch (err) {
    console.error("Error sending Telegram photo:", err);
  }
}

/**
 * Send document (GeoTIFF / QML / CSV) to Telegram chat with HTML-fallback
 */
async function sendDocument(chatId, filePath, caption = "", replyMarkup = null) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn("sendDocument: file not found at", filePath);
      return;
    }
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
    formData.append(
      "document",
      new Blob([fileBuffer], { type: "application/octet-stream" }),
      fileName
    );
    if (replyMarkup) formData.append("reply_markup", JSON.stringify(replyMarkup));

    const res = await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn("sendDocument HTML error, retrying without HTML:", data.description);
      const fbForm = new FormData();
      fbForm.append("chat_id", chatId);
      fbForm.append("caption", caption.replace(/<[^>]*>/g, ""));
      fbForm.append("document", new Blob([fileBuffer], { type: "application/octet-stream" }), fileName);
      if (replyMarkup) fbForm.append("reply_markup", JSON.stringify(replyMarkup));
      const fbRes = await fetch(`${TELEGRAM_API}/sendDocument`, { method: "POST", body: fbForm });
      return await fbRes.json();
    }
    return data;
  } catch (err) {
    console.error("Error sending Telegram document:", err);
  }
}

/**
 * Helper to download file from Telegram by file_id
 */
async function getTelegramFileBuffer(fileId) {
  const getFileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  const fileJson = await getFileRes.json();
  if (!fileJson.ok || !fileJson.result || !fileJson.result.file_path) {
    throw new Error("Gagal mengambil info berkas dari Telegram.");
  }
  const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileJson.result.file_path}`;
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error("Gagal mengunduh isi berkas dari server Telegram.");
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Kirim Perintah Python ke QGIS Desktop Bridge (localhost:9876)
 */
function sendPyQgisCommand(pythonScript) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let responseData = "";
    client.setTimeout(3000);

    client.connect(9876, "localhost", () => {
      client.write(pythonScript);
    });

    client.on("data", (data) => {
      responseData += data.toString();
    });

    client.on("end", () => {
      resolve({ success: true, response: responseData });
    });

    client.on("timeout", () => {
      client.destroy();
      resolve({ success: false, error: "QGIS Socket Timeout" });
    });

    client.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Main persistent reply keyboard
 */
function getMainKeyboard() {
  return {
    keyboard: [
      [{ text: "🛰️ Mulai Analisis Spasial Baru" }],
      [{ text: "📚 Informasi & Referensi Metodologis" }],
      [{ text: "❓ Panduan & Standar Kartografi" }],
    ],
    resize_keyboard: true,
  };
}

/**
 * 🗺️ STEP 1: Category Hub Menu
 */
async function showCategoryHub(chatId, userName = "Sahabat GIS") {
  const text = `
✨ <b>SPATIAL ENGINE COPILOT v6.0 (SCIENTIFIC GRADE)</b>
<i>Earth Observation, Remote Sensing & Kartografi Standar BIG</i>
━━━━━━━━━━━━━━━━━━━━━
Halo <b>${userName}</b>! Silakan pilih kategori analisis di bawah ini:

1️⃣ 🛰️ <b>Citra Satelit & Spektral</b> (Sentinel-2, Landsat, SAR, NDVI, NDBI)
2️⃣ ⛰️ <b>Topografi & Elevasi 3D</b> (Copernicus DEM 30m, DEMNAS 8m, Kontur)
3️⃣ 📐 <b>Pemodelan Spasial & Bencana</b> (Kelerengan Permen PU, InaRISK, Suhu LST)
4️⃣ 🌍 <b>Data Global LULC & Iklim</b> (Dynamic World, ESRI 10m, WorldPop, VIIRS)
5️⃣ 🏛️ <b>Geoportal Resmi Indonesia</b> (RBI BIG, GISTARU ATR/BPN, InaRISK BNPB)
📚 <b>Informasi & Referensi</b> (Pusat Dokumentasi Sains & Regulasi)
━━━━━━━━━━━━━━━━━━━━━
`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "🛰️ 1. Citra Satelit & Spektral", callback_data: "cat:sat" },
      ],
      [
        { text: "⛰️ 2. Topografi & Elevasi 3D", callback_data: "cat:topo" },
      ],
      [
        { text: "📐 3. Pemodelan & Kebencanaan", callback_data: "cat:analysis" },
      ],
      [
        { text: "🌍 4. Data Global & LULC (10m)", callback_data: "cat:opendata" },
      ],
      [
        { text: "🏛️ 5. Geoportal Resmi Indonesia", callback_data: "cat:geoportal" },
      ],
      [
        { text: "📚 Informasi & Referensi Metodologis", callback_data: "ref:hub" },
      ],
    ],
  };

  return sendMessage(chatId, text, inlineKeyboard);
}

/**
 * 🛠️ STEP 2: Show Tools in Selected Category
 */
async function showToolList(chatId, categoryKey) {
  const filtered = Object.entries(TOOLS_REGISTRY).filter(
    ([id, tool]) => tool.cat === categoryKey
  );

  let catTitle = "Daftar Alat Analisis";
  if (categoryKey === "sat") catTitle = "🛰️ Citra Satelit & Spektral";
  else if (categoryKey === "topo") catTitle = "⛰️ Topografi & Elevasi 3D";
  else if (categoryKey === "analysis") catTitle = "📐 Pemodelan Spasial & Kebencanaan";
  else if (categoryKey === "opendata") catTitle = "🌍 Data Global & Iklim (LULC 10m)";
  else if (categoryKey === "geoportal") catTitle = "🏛️ Geoportal Resmi Indonesia (WMS/WFS)";

  const inlineButtons = filtered.map(([id, tool]) => [
    { text: `${tool.icon} ${tool.name}`, callback_data: `sel_tool:${id}` },
  ]);

  inlineButtons.push([{ text: "⬅️ Kembali ke Kategori Utama", callback_data: "nav_home" }]);

  const text = `
<b>${catTitle}</b>
<i>Pilih salah satu instrumen pengolahan di bawah ini:</i>
━━━━━━━━━━━━━━━━━━━━━
`;

  return sendMessage(chatId, text, { inline_keyboard: inlineButtons });
}

/**
 * 📂 PANDUAN & PROMPT UPLOAD FILE KHUSUS SAAT PILIH LOKASI
 */
async function promptUploadInstructions(chatId, toolId = null) {
  const session = userSessions.get(chatId) || {};
  const activeToolId = toolId || session.toolId || "sentinel2";
  const tool = TOOLS_REGISTRY[activeToolId] || TOOLS_REGISTRY.sentinel2;

  userSessions.set(chatId, {
    ...session,
    step: "AWAITING_FILE_UPLOAD",
    toolId: activeToolId,
    toolName: tool.name,
    category: tool.cat,
    icon: tool.icon,
  });

  const text = `
📂 <b>UPLOAD BATAS POLIGON (AOI)</b>
${tool.icon} <b>Analisis:</b> <code>${tool.name}</code>
━━━━━━━━━━━━━━━━━━━━━
Silakan <b>kirimkan berkas batas wilayah Anda</b> ke chat ini:

📦 <b>Format yang Didukung:</b>
1. <b>Shapefile Zip (.zip)</b> — Berisi file <code>.shp</code>, <code>.dbf</code>, <code>.shx</code>, <code>.prj</code>
2. <b>GeoJSON (.geojson / .json)</b> — Poligon batas koordinat WGS84
3. <b>Google Earth KML (.kml)</b>

💡 <b>Cara Upload:</b>
Klik ikon klip kertas (📎) di Telegram $\rightarrow$ Pilih <i>File/Berkas</i> $\rightarrow$ Pilih file dari HP/Laptop Anda.

<i>✨ Output GeoTIFF & Preview akan langsung dipotong presisi mengikuti siluet poligon Anda!</i>
`;

  const inlineKeyboard = {
    inline_keyboard: [
      [{ text: "⬅️ Batal & Ketik Nama Wilayah", callback_data: `sel_tool:${activeToolId}` }],
    ],
  };

  return sendMessage(chatId, text, inlineKeyboard);
}

/**
 * ✏️ STEP 3: Prompt User to Select Region / Upload File
 */
async function promptRegionInput(chatId, toolId) {
  const tool = TOOLS_REGISTRY[toolId];
  if (!tool) return showCategoryHub(chatId);

  // Jika geoportal, tangani langsung
  if (tool.cat === "geoportal") {
    return handleGeoportalSelection(chatId, toolId);
  }

  // Jika user sebelumnya sudah meng-upload SHP/GeoJSON, LANGSUNG PROSES INSTAN!
  const session = userSessions.get(chatId) || {};
  if (session.customUpload && session.bbox) {
    userSessions.set(chatId, {
      ...session,
      toolId: toolId,
      toolName: tool.name,
      category: tool.cat,
      icon: tool.icon,
    });
    return processRegionDirectly(chatId, session.bbox, session.customUpload.baseName);
  }

  // Set Session State untuk pencarian teks
  userSessions.set(chatId, {
    step: "AWAITING_REGION",
    toolId: toolId,
    toolName: tool.name,
    category: tool.cat,
    icon: tool.icon,
  });

  const text = `
${tool.icon} <b>ANALISIS TERPILIH:</b>
<b>${tool.name}</b>
<i>${tool.desc}</i>
━━━━━━━━━━━━━━━━━━━━━
📍 <b>Tentukan Wilayah Studi:</b>
• Ketik nama wilayah pada kolom chat (misal: <code>Kabupaten Tegal</code>, <code>Kota Semarang</code>)
• ATAU pilih tombol cepat / <b>upload berkas Shapefile/GeoJSON</b> di bawah:
`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "📂 Upload File Shapefile (.zip) / GeoJSON", callback_data: `act_upload:${toolId}` },
      ],
      [
        { text: "🏛️ Kab. Tegal", callback_data: `quick_reg:Kabupaten Tegal` },
        { text: "🏙️ Kota Semarang", callback_data: `quick_reg:Kota Semarang` },
      ],
      [
        { text: "🌲 Kawasan Inti IKN", callback_data: `quick_reg:Kawasan Inti IKN` },
        { text: "🌋 DI Yogyakarta", callback_data: `quick_reg:DI Yogyakarta` },
      ],
      [
        { text: "⬅️ Ganti Pilihan Analisis", callback_data: `cat:${tool.cat}` },
      ],
    ],
  };

  return sendMessage(chatId, text, inlineKeyboard);
}


/**
 * 🎯 SMART SEARCH: Disambiguation Menu for multi-matches
 */
async function handleSmartSearchInput(chatId, query) {
  const session = userSessions.get(chatId) || {};
  const toolId = session.toolId || "sentinel2";
  const tool = TOOLS_REGISTRY[toolId] || TOOLS_REGISTRY.sentinel2;

  await sendMessage(chatId, `🔍 <i>Mencari entitas wilayah untuk "<b>${query}</b>"...</i>`);

  try {
    const candidates = await searchLocationCandidates(query);

    if (candidates.length === 0) {
      // Fallback geocoding default -> langsung proses instan
      const bbox = await resolveBoundingBox(query);
      return processRegionDirectly(chatId, bbox, query);
    }

    if (candidates.length === 1) {
      // Single match -> LANGSUNG PROSES INSTAN!
      return processRegionDirectly(chatId, candidates[0].bbox, candidates[0].title);
    }

    // Multiple matches -> tampilkan tombol pilihan presisi (Disambiguation)
    userSessions.set(chatId, {
      ...session,
      step: "AWAITING_CANDIDATE",
      candidates: candidates,
    });

    const candidateButtons = candidates.slice(0, 5).map((c, idx) => [
      { text: `${c.title}`, callback_data: `sel_cand:${idx}` },
    ]);

    candidateButtons.push([
      { text: "✏️ Ketik Ulang Nama Wilayah", callback_data: `sel_tool:${toolId}` },
      { text: "🏠 Menu Utama", callback_data: "nav_home" },
    ]);

    const text = `
🎯 <b>PILIHAN WILAYAH DITEMUKAN:</b>
<i>Ditemukan beberapa entitas administratif untuk "<b>${query}</b>":</i>
━━━━━━━━━━━━━━━━━━━━━
Silakan pilih salah satu untuk <b>langsung diproses</b>:
`;

    return sendMessage(chatId, text, { inline_keyboard: candidateButtons });
  } catch (err) {
    console.error("Smart Search Error:", err);
    const bbox = await resolveBoundingBox(query);
    return processRegionDirectly(chatId, bbox, query);
  }
}

/**
 * 🚀 STEP 4: Direct Instant Processing (No unnecessary resolution prompt!)
 */
async function processRegionDirectly(chatId, bbox, displayName) {
  const session = userSessions.get(chatId) || {};
  const toolId = session.toolId || "sentinel2";
  const tool = TOOLS_REGISTRY[toolId] || TOOLS_REGISTRY.sentinel2;

  const centerLon = (bbox.minLon + bbox.maxLon) / 2;
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const utm = getIndonesianUtmZone(centerLon, centerLat);
  const geoArea = calculateGeodesicAreaHa(bbox);

  userSessions.set(chatId, {
    ...session,
    toolId,
    regionQuery: displayName || bbox.name,
    bbox: bbox,
    utm: utm,
    geoArea: geoArea,
  });

  return executeProcessing(chatId, "hd");
}

/**
 * 🚀 STEP 5: Execute Processing & Deliver Output Instantly
 */
async function executeProcessing(chatId, resOpt = "hd") {
  const session = userSessions.get(chatId);
  if (!session || !session.bbox || !session.toolId) {
    return showCategoryHub(chatId);
  }

  const { toolId, regionQuery, bbox, utm, geoArea } = session;
  const tool = TOOLS_REGISTRY[toolId];

  await sendMessage(
    chatId,
    `⚙️ <b>Memproses:</b> ${tool.icon} <code>${tool.name}</code>\n📍 <b>Wilayah:</b> <b>${bbox.name}</b>\n📐 Luas: <b>${geoArea?.areaHa?.toLocaleString("id-ID") || "~"} ha</b> | Proyeksi: <code>${utm?.name || "EPSG:3857"}</code>\n⏳ <i>Mengunduh data spektral resolusi asli & menerapkan styling kartografi...</i>`
  );

  try {
    let result = null;

    // 1. Satelit & Topografi
    if (["sentinel2", "landsat", "radar", "satellite_rgb", "ndvi", "ndbi", "landcover", "dem", "dsm", "hillshade"].includes(toolId)) {
      result = await generateUniversalGeoTIFF(toolId, regionQuery, bbox, resOpt);
    }
    // 2. Analisis Spasial & Bencana
    else if (toolId === "slope") {
      result = await generateSlopeAnalysis(regionQuery, bbox, resOpt);
    } else if (toolId === "hydro") {
      result = await generateHydrologyDrainage(regionQuery, bbox, resOpt);
    } else if (toolId === "hazard") {
      result = await generateMultiHazardAnalysis(regionQuery, bbox, resOpt);
    } else if (toolId === "lst") {
      result = await generateLstThermalAnalysis(regionQuery, bbox, resOpt);
    }
    // 3. OpenData Global LULC & Iklim
    else if (toolId === "pop") {
      result = await generateWorldPopDensity(regionQuery, bbox, resOpt);
    } else if (toolId === "viirs") {
      result = await generateViirsNightLights(regionQuery, bbox, resOpt);
    } else if (toolId === "ghsl") {
      result = await generateGhslBuiltupEpoch(regionQuery, bbox, resOpt);
    } else if (toolId === "forest") {
      result = await generateForestCanopyCover(regionQuery, bbox, resOpt);
    } else if (toolId === "s5p") {
      result = await generateSentinel5pAirQuality(regionQuery, bbox, resOpt);
    } else if (toolId === "rain") {
      result = await generateChirpsRainfall(regionQuery, bbox, resOpt);
    } else if (toolId === "solar") {
      result = await generateGlobalSolarAtlas(regionQuery, bbox, resOpt);
    } else if (toolId === "dw") {
      result = await generateDynamicWorldLulc(regionQuery, bbox, resOpt);
    } else if (toolId === "esri") {
      result = await generateEsriMultiYearLandCover(regionQuery, bbox, resOpt);
    }

    // Handle Scientific Quality Gate Blocking (No Synthetic Replacements)
    if (result && result.status === "ANALYSIS_BLOCKED") {
      const nextActions = {
        inline_keyboard: [
          [{ text: "📚 Baca Dasar Metodologi & Regulasi", callback_data: "ref:hub" }],
          [{ text: "🗺️ Coba Citra Satelit Optik (VHR)", callback_data: "sel_tool:vhr_optik" }],
          [{ text: "🏠 Menu Utama", callback_data: "nav_home" }],
        ],
      };
      return sendMessage(chatId, result.message, nextActions);
    }

    if (!result || !result.tifPath || !fs.existsSync(result.tifPath)) {
      throw new Error("Gagal menyusun berkas GeoTIFF raster berstandar.");
    }

    // Injeksi Otomatis ke QGIS Desktop via Bridge
    const pyScript = `
import os
from qgis.core import QgsRasterLayer, QgsProject
from qgis.utils import iface

tif_file = r"${result.tifPath.replace(/\\/g, "/")}"
layer_name = "${tool.name} - ${regionQuery}"
rlayer = QgsRasterLayer(tif_file, layer_name)
if rlayer.isValid():
    QgsProject.instance().addMapLayer(rlayer)
    iface.setActiveLayer(rlayer)
    iface.zoomToActiveLayer()
    iface.mapCanvas().refresh()
    print("SUCCESS: Layer Loaded")
else:
    print("ERROR: Layer Invalid")
`;
    sendPyQgisCommand(pyScript).catch(() => {});

    // 1. Kirim Peta Layout Kartografis Akademis (Standar Jurnal & BIG) ke Telegram
    if (result.previewPngPath && fs.existsSync(result.previewPngPath)) {
      let finalPhotoBuf = fs.readFileSync(result.previewPngPath);
      try {
        const layoutOutPath = result.previewPngPath.replace(/_preview\.png$/i, "_academic_layout.png");
        const layoutRes = await generateCartographicLayoutMap({
          rawImagePath: result.previewPngPath,
          toolId: toolId,
          toolName: tool.name,
          regionName: bbox.name,
          bbox: bbox,
          utm: utm,
          geoArea: geoArea,
          resolution: result.resolution || "10 m/pixel",
          outputPath: layoutOutPath,
        });
        if (layoutRes && layoutRes.buffer) {
          finalPhotoBuf = layoutRes.buffer;
        }
      } catch (layoutErr) {
        console.warn("Layout generation failed, fallback to raw preview:", layoutErr.message);
      }

      const cap = `🗺️ <b>PETA KARTOGRAFIS RESMI: ${tool.name.toUpperCase()}</b>\n📍 Wilayah: <b>${bbox.name}</b>\n📐 Luas: <b>${geoArea?.areaHa?.toLocaleString("id-ID") || "~"} Hektar</b>\n🗺️ Proyeksi: <code>${utm?.name || "EPSG:3857"}</code>\n<i>✨ Dilengkapi Skala Metrik, Kompas Arah Utara (U), Bar Legenda & Grid Koordinat Sumbu X-Y.</i>`;
      await sendPhoto(chatId, finalPhotoBuf, cap);
    }

    // 2. Kirim File GeoTIFF (.TIF)
    let metaCaption = `🛰️ <b>PRODUK SPASIAL BERSTANDAR CARTOGRAPHIC</b>\n`;
    metaCaption += `━━━━━━━━━━━━━━━━━━━━━\n`;
    metaCaption += `📦 <b>Instrumen:</b> ${tool.name}\n`;
    metaCaption += `📍 <b>Wilayah:</b> ${bbox.name}\n`;
    metaCaption += `🌐 <b>Sistem Koordinat:</b> <code>EPSG:3857 (Web Mercator)</code>\n`;
    metaCaption += `🗺️ <b>Zona UTM Indonesia:</b> <code>${utm?.name || "Zona UTM Standar BIG"}</code>\n`;
    metaCaption += `📐 <b>Estimasi Luas Wilayah:</b> <b>${geoArea?.areaHa?.toLocaleString("id-ID") || "~"} Hektar</b>\n`;
    metaCaption += `📏 <b>Ground Resolution:</b> <code>${result.resolution || "10m/px"}</code>\n`;
    metaCaption += `💾 <b>Ukuran Berkas:</b> <code>${result.fileSizeMb} MB</code>\n`;

    if (result.zonalStats && Array.isArray(result.zonalStats)) {
      metaCaption += `\n📊 <b>Matriks Distribusi Spasial:</b>\n`;
      result.zonalStats.forEach((st) => {
        metaCaption += `  • ${st.name}: <b>${st.pct}%</b> (${st.areaHa.toLocaleString("id-ID")} ha)\n`;
      });
    }

    if (result.tempStats) {
      metaCaption += `\n🌡️ <b>Distribusi Suhu (LST):</b>\n`;
      metaCaption += `  • Suhu Min: <b>${result.tempStats.min}</b> | Rata-rata: <b>${result.tempStats.avg}</b> | Max: <b>${result.tempStats.max}</b>\n`;
    }

    metaCaption += `━━━━━━━━━━━━━━━━━━━━━\n`;
    metaCaption += `💻 <i>File .TFW & .PRJ tertanam otomatis. Snap 100% presisi di atas basemap QGIS!</i>`;

    await sendDocument(chatId, result.tifPath, metaCaption);

    // 3. Kirim File Legenda .QML jika ada
    if (result.qmlPath && fs.existsSync(result.qmlPath)) {
      await sendDocument(chatId, result.qmlPath, `🎨 <b>File Legenda Simbologi Resmi QGIS (.QML)</b>\n<i>Gunakan untuk otomatis menampilkan legenda label kelas di Table of Contents QGIS.</i>`);
    }

    // Action Buttons Setelah Selesai
    const nextActions = {
      inline_keyboard: [
        [
          { text: `🔄 Analisis Wilayah Lain (${tool.name})`, callback_data: `sel_tool:${toolId}` },
        ],
        [
          { text: "📂 Upload SHP/GeoJSON Area Lain", callback_data: "act_upload" },
          { text: "🏠 Menu Baru", callback_data: "nav_home" },
        ],
      ],
    };

    return sendMessage(
      chatId,
      `✅ <b>Selesai!</b> Berkas GeoTIFF + File Legenda .QML berstandar kartografis siap diolah.`,
      nextActions
    );
  } catch (err) {
    console.error("Execution Error:", err);
    return sendMessage(
      chatId,
      `❌ <b>Gagal memproses data:</b> ${err.message}\nSilakan coba kembali atau pilih wilayah lain.`,
      getMainKeyboard()
    );
  }
}

/**
 * Handle Geoportal Selection
 */
async function handleGeoportalSelection(chatId, toolId) {
  const service = GEOPORTAL_SERVICES[toolId];
  if (!service) return showCategoryHub(chatId);

  const pyScript = service.qgisSnippet;
  sendPyQgisCommand(pyScript).catch(() => {});

  let text = `
🏛️ <b>LAYANAN GEOPORTAL RESMI INDONESIA</b>
<b>${service.name}</b>
<i>${service.institution}</i>
━━━━━━━━━━━━━━━━━━━━━
📋 <b>Spesifikasi Service:</b>
• <b>Tipe Layanan:</b> <code>${service.type}</code>
• <b>Standard CRS:</b> <code>${service.crs}</code>
• <b>URL Endpoint:</b>
<code>${service.url}</code>
• <b>Nama Layer Resmi:</b> <code>${service.layerName}</code>

💻 <b>Status QGIS Desktop:</b>
<i>Perintah koneksi telah dikirimkan langsung ke QGIS Desktop Anda! Layer otomatis streaming via WMS.</i>
`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "⬅️ Pilih Geoportal / Layer Lain", callback_data: "cat:geoportal" },
      ],
      [
        { text: "🏠 Menu Utama", callback_data: "nav_home" },
      ],
    ],
  };

  return sendMessage(chatId, text, inlineKeyboard);
}

/**
 * Handle Information & Scientific References Menu
 */
async function handleReferenceMenu(chatId, subKey = "hub") {
  if (subKey === "hub") {
    const text = `
📚 <b>INFORMASI & PANDUAN METODOLOGIS ILMIAH</b>
<i>Dokumentasi Spesifikasi Sensor, Formulasi Matematika, Standar Nasional, dan Basis Pustaka Peer-Reviewed</i>
━━━━━━━━━━━━━━━━━━━━━
Spatial Engine Copilot v6.0 beroperasi dengan standar <b>Scientific Rigor</b> penuh. Seluruh pengolahan data remote sensing dan analisis spasial tunduk pada prinsip pembuktian fisik dan verifikasi radiometrik:

Pilih topik dokumentasi metodologis di bawah ini:
`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🛰️ Katalog & Sensor Satelit", callback_data: "ref:katalog" },
          { text: "📐 Metodologi & Algoritma Analisis", callback_data: "ref:metode" },
        ],
        [
          { text: "📋 Standar Klasifikasi & Regulasi", callback_data: "ref:standar" },
          { text: "🌐 Sistem Referensi Koordinat & UTM", callback_data: "ref:proyeksi" },
        ],
        [
          { text: "🛡️ Validasi & Batasan Analisis", callback_data: "ref:validasi" },
          { text: "📖 Daftar Pustaka Akademik (APA 7th)", callback_data: "ref:pustaka" },
        ],
        [
          { text: "🏠 Menu Utama", callback_data: "nav_home" },
        ],
      ],
    };
    return sendMessage(chatId, text, keyboard);
  }

  if (subKey === "katalog") {
    const text = `
🛰️ <b>KATALOG DATASET & SPESIFIKASI SENSOR SATELIT</b>
━━━━━━━━━━━━━━━━━━━━━
<b>1. Copernicus Sentinel-2 MSI (Level-2A BOA)</b>
• <b>Penyedia:</b> European Space Agency (ESA) / European Commission
• <b>Resolusi Spasial:</b> 10 m (VNIR Band 2, 3, 4, 8) | 20 m (SWIR Band 11, 12)
• <b>Resolusi Temporal:</b> 5 hari (konstelasi 2A + 2B)
• <b>Tingkat Produk:</b> Level-2A Bottom-of-Atmosphere (BOA) Surface Reflectance
• <b>Lisensi:</b> Copernicus Open Access (Gratis & Terbuka)

<b>2. USGS Landsat 8/9 OLI & TIRS (Collection 2 Level-2)</b>
• <b>Penyedia:</b> USGS / NASA
• <b>Resolusi Spasial:</b> 30 m (Multispektral & Termal Band 10)
• <b>Resolusi Temporal:</b> 16 hari (8 hari gabungan L8 + L9)
• <b>Sensor Termal:</b> TIRS (Thermal Infrared Sensor) untuk Surface Temperature (LST)
• <b>Lisensi:</b> USGS Public Domain

<b>3. Copernicus DEM GLO-30 (Global Elevation)</b>
• <b>Penyedia:</b> ESA / Airbus Defence and Space
• <b>Resolusi Spasial:</b> 30 meter (1 arc-second)
• <b>Akurasi Vertikal (LE90):</b> < 4 meter
• <b>Format Model:</b> Digital Surface Model (DSM) terkalibrasi global

<b>4. DEMNAS (Badan Informasi Geospasial)</b>
• <b>Penyedia:</b> BIG (Republik Indonesia)
• <b>Resolusi Spasial:</b> 0.27 arc-second (~8.27 meter)
• <b>Datum Vertikal:</b> EGM2008 Geoid

<b>5. WorldPop & VIIRS DNB</b>
• <b>WorldPop:</b> 100 m resolusi kepadatan penduduk estimasi spasial berdasar Random Forest disaggregation.
• <b>VIIRS Day/Night Band:</b> 500 m nightly radiance (nW/cm²/sr) sensor Suomi-NPP / NOAA-20.
`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "⬅️ Kembali ke Pusat Referensi", callback_data: "ref:hub" }],
        [{ text: "🏠 Menu Utama", callback_data: "nav_home" }],
      ],
    };
    return sendMessage(chatId, text, keyboard);
  }

  if (subKey === "metode") {
    const text = `
📐 <b>METODOLOGI ANALISIS & ALGORITMA MATEMATIS</b>
━━━━━━━━━━━━━━━━━━━━━
<b>1. Normalized Difference Vegetation Index (NDVI)</b>
<code>NDVI = (NIR - RED) / (NIR + RED)</code>
• <b>Band Fisik Wajib:</b> NIR (830–870 nm) & Red (650–680 nm) Surface Reflectance.
• <b>Prinsip Fisika:</b> Penyerapan kuat klorofil pada Red dan pantulan tinggi mesofil spons daun pada NIR.
• <i>Kebijakan: Dilarang keras menggunakan kanal visual RGB (Green-Red).</i>

<b>2. Normalized Difference Built-up Index (NDBI)</b>
<code>NDBI = (SWIR1 - NIR) / (SWIR1 + NIR)</code>
• <b>Band Fisik Wajib:</b> SWIR-1 (1550–1750 nm) & NIR (830–870 nm).
• <b>Prinsip:</b> Material semen/aspal memiliki reflektansi SWIR lebih tinggi daripada NIR.

<b>3. Analisis Kelerengan Morfometri Medan (Horn 1981)</b>
<code>dz/dx = ((z3 + 2*z6 + z9) - (z1 + 2*z4 + z7)) / (8 * dx)</code>
<code>dz/dy = ((z7 + 2*z8 + z9) - (z1 + 2*z2 + z3)) / (8 * dy)</code>
<code>Slope (Derajat) = arctan(sqrt(dz/dx² + dz/dy²)) * (180 / π)</code>
• <b>Filter Kernel:</b> 3x3 moving window dengan pembobotan invers jarak Horn.
• <b>Syarat Geodesi:</b> Wajib dihitung pada matriks proyeksi planar metrik (UTM).

<b>4. Land Surface Temperature (LST)</b>
<code>Ts = γ * [1/ε * (ψ1 * L_sensor + ψ2) + ψ3] + δ</code>
• <b>Syarat Fisik:</b> Menggunakan kalibrasi radiansi saluran Termal Inframerah (TIRS Band 10 / MODIS).
`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "⬅️ Kembali ke Pusat Referensi", callback_data: "ref:hub" }],
        [{ text: "🏠 Menu Utama", callback_data: "nav_home" }],
      ],
    };
    return sendMessage(chatId, text, keyboard);
  }

  if (subKey === "standar") {
    const text = `
📋 <b>STANDAR KLASIFIKASI & REGULASI NASIONAL</b>
━━━━━━━━━━━━━━━━━━━━━
<b>1. Klasifikasi Kelerengan (Permen PU No. 20/PRT/M/2007)</b>
Pedoman Teknis Analisis Aspek Fisik & Lingkungan Penyusunan RTRW:
• 🟩 <b>0 - 8 % (0 - 4.5°):</b> Datar (Sangat sesuai permukiman & pertanian intensif)
• 🟩 <b>8 - 15 % (4.5 - 8.5°):</b> Landai (Permukiman dengan konservasi tanah ringan)
• 🟨 <b>15 - 25 % (8.5 - 14.0°):</b> Agak Curam (Kawasan penyangga, budidaya terbatas)
• 🟧 <b>25 - 45 % (14.0 - 24.2°):</b> Curam (Kawasan lindung, rawan longsor/erosi)
• 🟥 <b>> 45 % (> 24.2°):</b> Sangat Curam (Mutlak lindung, bahaya longsor tinggi)

<b>2. Pengkajian Risiko Bencana (Perka BNPB No. 02/2012)</b>
<code>Risiko (R) = [Bahaya (H) × Kerentanan (V)] / Kapasitas (C)</code>
• <b>Indikator Multi-Bahaya:</b> Banjir, Tanah Longsor, Kekeringan, Gelombang Pasang.
• Mengacu pada klasifikasi spasial InaRISK BNPB.

<b>3. Ketentuan Kartografi SNI 6502.2:2010</b>
• Spesifikasi Penyajian Peta Rupa Bumi Indonesia Skala 1:25.000.
• Tata letak kartografis wajib memuat: Grid koordinat, Skala grafis batang & numerik, Orientasi arah Utara sejati, dan Legenda tematik resmi.
`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "⬅️ Kembali ke Pusat Referensi", callback_data: "ref:hub" }],
        [{ text: "🏠 Menu Utama", callback_data: "nav_home" }],
      ],
    };
    return sendMessage(chatId, text, keyboard);
  }

  if (subKey === "proyeksi") {
    const text = `
🌐 <b>SISTEM REFERENSI KOORDINAT & PROYEKSI PETA</b>
━━━━━━━━━━━━━━━━━━━━━
<b>1. Datum Geodesi: WGS 84 / SRGI 2013</b>
• Sumbu semi-mayor: a = 6.378.137,0 m
• Flatting invers: 1/f = 298,257223563
• Selaras dengan Sistem Referensi Geospasial Indonesia 2013 (SRGI2013).

<b>2. Proyeksi Universal Transverse Mercator (UTM)</b>
Wilayah kedaulatan NKRI membentang dari <b>Zona 46N hingga Zona 54S</b>:
• Zona 46N/S: Aceh, Sumatera Utara bagian barat
• Zona 47N/S: Sumatera bagian tengah
• Zona 48N/S: Sumatera Selatan, Lampung, DKI Jakarta, Jawa Barat barat
• Zona 49S: Jawa Barat timur, Jawa Tengah, DI Yogyakarta, Jawa Timur barat
• Zona 50S: Jawa Timur timur, Madura, Bali, NTB, Kalimantan Timur/Selatan
• Zona 51S - 54S: NTT, Sulawesi, Maluku, dan Papua
• <b>Parameter Grid:</b> Skala faktor meridian tengah 0.9996, False Easting 500.000 m.

<b>3. Perhitungan Luas Area Geodesik</b>
• Perhitungan luas area menggunakan integrasi geodesik <b>Karney (2013)</b> pada ellipsoid WGS84, bukan proyeksi bidang datar planar bola, sehingga bebas dari distorsi skala lintang khatulistiwa.
`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "⬅️ Kembali ke Pusat Referensi", callback_data: "ref:hub" }],
        [{ text: "🏠 Menu Utama", callback_data: "nav_home" }],
      ],
    };
    return sendMessage(chatId, text, keyboard);
  }

  if (subKey === "validasi") {
    const text = `
🛡️ <b>KEBIJAKAN VALIDASI & BATASAN PENGGUNAAN DATA</b>
━━━━━━━━━━━━━━━━━━━━━
<b>1. Prinsip Strict Zero Pseudo-Data</b>
<i>"Absence of data is never converted into presence of data."</i>
Sistem menolak tegas pembuatan data tiruan, interpolasi acak (Math.random), atau manipulasi visual brightness/kontras menjadi data biofisik.

<b>2. Status Mutu Pemrosesan:</b>
• 🟢 <code>VALIDATED</code>: Data diperoleh dari sensor terkalibrasi Level-2A/DEMNAS dengan kontrol awan < 20%.
• 🟡 <code>PARTIALLY_VALIDATED</code>: Produk global (30m–100m) yang membutuhkan verifikasi uji petik lapangan (ground truthing).
• 🔴 <code>ANALYSIS_BLOCKED</code>: Permintaan dihentikan secara protektif karena data spektral/topografi primer tidak memenuhi standar ilmiah.

<b>3. Batasan Teknis & Rekayasa:</b>
• Data kelerengan DEM 30m menggeneralisasi tebing mikro dan tidak boleh digunakan untuk perhitungan daya dukung pondasi teknik sipil mikro tanpa penyelidikan geoteknik lapangan.
• Data Sentinel-2 L2A rentan saturasi pada indeks vegetasi kanopi hutan primer dengan LAI > 3.
`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "⬅️ Kembali ke Pusat Referensi", callback_data: "ref:hub" }],
        [{ text: "🏠 Menu Utama", callback_data: "nav_home" }],
      ],
    };
    return sendMessage(chatId, text, keyboard);
  }

  if (subKey === "pustaka") {
    const text = `
📖 <b>DAFTAR PUSTAKA AKADEMIK UTAMA (APA 7th Edition)</b>
━━━━━━━━━━━━━━━━━━━━━
• <b>Horn, B. K. (1981).</b> Hill shading and the reflectance map. <i>Proceedings of the IEEE</i>, 69(1), 14–47. https://doi.org/10.1109/PROC.1981.11918
• <b>Rouse, J. W., Haas, R. H., Schell, J. A., & Deering, D. W. (1974).</b> Monitoring vegetation systems in the Great Plains with ERTS. <i>Third Earth Resources Technology Satellite-1 Symposium</i>, NASA SP-351, 309–317.
• <b>Tucker, C. J. (1979).</b> Red and photographic infrared linear combinations for monitoring vegetation. <i>Remote Sensing of Environment</i>, 8(2), 127–150. https://doi.org/10.1016/0034-4257(79)90013-0
• <b>Zha, Y., Gao, J., & Ni, S. (2003).</b> Use of normalized difference built-up index in automatically mapping urban areas from TM imagery. <i>International Journal of Remote Sensing</i>, 24(3), 583–594. https://doi.org/10.1080/01431160304987
• <b>Xu, H. (2006).</b> Modification of normalised difference water index (MNDWI) to enhance open water features in remotely sensed imagery. <i>International Journal of Remote Sensing</i>, 27(14), 3025–3033. https://doi.org/10.1080/01431160600589179
• <b>Sobrino, J. A., Jiménez-Muñoz, J. C., & Paolini, L. (2004).</b> Land surface temperature retrieval from LANDSAT TM 5. <i>Remote Sensing of Environment</i>, 90(4), 434–440. https://doi.org/10.1016/j.rse.2004.02.003
• <b>O'Callaghan, J. F., & Mark, D. M. (1984).</b> The extraction of drainage networks from digital elevation data. <i>Computer Vision, Graphics, and Image Processing</i>, 28(3), 323–344.
• <b>Badan Informasi Geospasial (BIG). (2018).</b> <i>Peraturan Badan Informasi Geospasial No. 6 Tahun 2018 tentang Jaring Kontrol Geodesi</i>.
• <b>Kementerian Pekerjaan Umum RI. (2007).</b> <i>Peraturan Menteri Pekerjaan Umum No. 20/PRT/M/2007 tentang Pedoman Teknis Analisis Aspek Fisik & Lingkungan</i>.
`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "⬅️ Kembali ke Pusat Referensi", callback_data: "ref:hub" }],
        [{ text: "🏠 Menu Utama", callback_data: "nav_home" }],
      ],
    };
    return sendMessage(chatId, text, keyboard);
  }
}

/**
 * Handle Telegram Callback Queries
 */
async function handleCallbackQuery(cq) {
  const cqId = cq.id;
  const chatId = cq.message.chat.id;
  const data = cq.data || "";

  // 1. Navigasi Home
  if (data === "nav_home") {
    await answerCallbackQuery(cqId);
    return showCategoryHub(chatId);
  }

  // 2. Tombol Upload Berkas
  if (data === "act_upload" || data.startsWith("act_upload:")) {
    const specificToolId = data.includes(":") ? data.split(":")[1] : null;
    await answerCallbackQuery(cqId, "Mode Upload File Aktif");
    return promptUploadInstructions(chatId, specificToolId);
  }

  // 3. Navigasi Informasi & Referensi Metodologis
  if (data.startsWith("ref:")) {
    const subKey = data.replace("ref:", "");
    await answerCallbackQuery(cqId);
    return handleReferenceMenu(chatId, subKey);
  }

  // 4. Pilih Kategori
  if (data.startsWith("cat:")) {
    const cat = data.replace("cat:", "");
    await answerCallbackQuery(cqId);
    return showToolList(chatId, cat);
  }

  // 5. Pilih Alat / Analisis
  if (data.startsWith("sel_tool:")) {
    const toolId = data.replace("sel_tool:", "");
    await answerCallbackQuery(cqId, `Memilih: ${TOOLS_REGISTRY[toolId]?.name || toolId}`);
    return promptRegionInput(chatId, toolId);
  }

  // 6. Quick Preset Wilayah -> LANGSUNG PROSES!
  if (data.startsWith("quick_reg:")) {
    const reg = data.replace("quick_reg:", "");
    await answerCallbackQuery(cqId, `Memproses: ${reg}`);
    const bbox = await resolveBoundingBox(reg);
    return processRegionDirectly(chatId, bbox, reg);
  }

  // 7. Pilih Kandidat Smart Search Disambiguation -> LANGSUNG PROSES!
  if (data.startsWith("sel_cand:")) {
    const candIdx = parseInt(data.replace("sel_cand:", ""), 10);
    const session = userSessions.get(chatId) || {};
    if (session.candidates && session.candidates[candIdx]) {
      const chosen = session.candidates[candIdx];
      await answerCallbackQuery(cqId, `Lokasi: ${chosen.title}`);
      return processRegionDirectly(chatId, chosen.bbox, chosen.title);
    }
  }

  await answerCallbackQuery(cqId);
}

/**
 * Handle incoming Telegram Messages
 */
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const fromUser = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
  const text = msg.text ? msg.text.trim() : "";

  console.log(`🛰️ [SpatialEngine] Pesan dari ${fromUser}: "${text || (msg.document ? msg.document.file_name : '[File]')}"`);

  // 1. PENANGANAN UPLOAD FILE SHAPEFILE (.ZIP) ATAU GEOJSON
  if (msg.document) {
    const doc = msg.document;
    const fileName = doc.file_name || "spatial_data.zip";
    const ext = fileName.toLowerCase().split(".").pop();

    if (!["zip", "geojson", "json", "kml"].includes(ext)) {
      return sendMessage(
        chatId,
        `⚠️ Format berkas <b>.${ext}</b> tidak didukung.\nSilakan upload file <b>.geojson</b> atau <b>.zip (berisi Shapefile .shp/.dbf)</b>.`,
        getMainKeyboard()
      );
    }

    await sendMessage(chatId, `⏳ <i>Mengunduh dan mengekstrak geometri poligon dari <b>${fileName}</b>...</i>`);

    try {
      const fileBuffer = await getTelegramFileBuffer(doc.file_id);
      const parsed = await parseUploadedSpatialFile(fileBuffer, fileName);

      const centerLon = parsed.centerLon;
      const centerLat = parsed.centerLat;
      const utm = getIndonesianUtmZone(centerLon, centerLat);

      const session = userSessions.get(chatId) || {};
      userSessions.set(chatId, {
        ...session,
        customUpload: parsed,
        bbox: parsed.bbox,
        utm: utm,
      });

      // Jika user sebelumnya sudah memilih alat analisis, LANGSUNG PROSES!
      if (session.toolId) {
        return processRegionDirectly(chatId, parsed.bbox, parsed.baseName);
      }

      const confirmText = `
📂 <b>BERKAS SPASIAL BERHASIL DIMUAT!</b>
━━━━━━━━━━━━━━━━━━━━━
📄 <b>Nama Berkas:</b> <code>${fileName}</code>
🗂️ <b>Tipe Format:</b> ${parsed.sourceType} (${parsed.featureCount} Poligon / ${parsed.pointCount} Vertex)
📐 <b>Estimasi Luas Area:</b> <b>${parsed.approxAreaHa.toLocaleString("id-ID")} Hektar</b>
🗺️ <b>Zona UTM Standar BIG:</b> <code>${utm.name}</code>
📍 <b>Titik Tengah:</b> <code>${centerLat.toFixed(4)}, ${centerLon.toFixed(4)}</code>
✂️ <b>Auto-Clip Mask:</b> <i>Hasil raster akan otomatis dipotong presisi mengikuti siluet poligon ini!</i>
━━━━━━━━━━━━━━━━━━━━━
<b>Pilih Analisis yang Ingin Dijalankan:</b>
`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "🛰️ Citra Satelit & Spektral (NDBI/NDVI)", callback_data: "cat:sat" },
          ],
          [
            { text: "⛰️ Topografi & Elevasi (DEM/DSM)", callback_data: "cat:topo" },
          ],
          [
            { text: "📐 Pemodelan Kelerengan & Bencana", callback_data: "cat:analysis" },
          ],
          [
            { text: "🌍 Data Global & Tutupan Lahan 10m", callback_data: "cat:opendata" },
          ],
        ],
      };

      return sendMessage(chatId, confirmText, inlineKeyboard);
    } catch (err) {
      console.error("File Parse Error:", err);
      return sendMessage(
        chatId,
        `❌ <b>Gagal membaca berkas spasial:</b> ${err.message}\nPastikan file zip berisi berkas .shp yang valid atau file .geojson valid dengan proyeksi WGS84 (EPSG:4326).`,
        getMainKeyboard()
      );
    }
  }

  // 2. COMMAND: /start, /menu, /help, Mulai Analisis
  if (
    text === "/start" ||
    text === "/help" ||
    text === "/menu" ||
    text === "menu" ||
    text === "🛰️ Mulai Analisis Spasial Baru"
  ) {
    userSessions.delete(chatId);
    return showCategoryHub(chatId, msg.from.first_name);
  }

  // 2B. INFORMASI & REFERENSI METODOLOGIS
  if (
    text === "📚 Informasi & Referensi Metodologis" ||
    text === "/referensi" ||
    text === "/metode" ||
    text === "/katalog" ||
    text === "/pustaka"
  ) {
    return handleReferenceMenu(chatId, "hub");
  }

  // 3. MENU PANDUAN STANDAR KARTOGRAFI
  if (text === "❓ Panduan & Standar Kartografi") {
    const guide = `
📖 <b>PANDUAN STANDAR KARTOGRAFI SPATIAL ENGINE</b>
━━━━━━━━━━━━━━━━━━━━━
Setiap produk peta dan analisis dari bot ini dilengkapi dengan:

1. <b>Auto-Clip Masking Poligon</b>: Dukungan upload file Shapefile (.zip) dan GeoJSON untuk pemotongan raster otomatis.
2. <b>Smart Search Disambiguation</b>: Penemuan wilayah presisi dengan opsi pemilihan Kabupaten vs Kota tanpa ambiguitas.
3. <b>True 3-Band Cartographic RGB</b>: Tampilan warna tematik siap pakai tanpa perlu styling manual di QGIS.
4. <b>File Legenda .QML Resmi</b>: Menyematkan deskripsi kelas (misal: 0-8% Datar Permen PU) langsung di TOC QGIS.
5. <b>Proyeksi Presisi EPSG:3857 & UTM</b>: Deteksi otomatis zona UTM 46N–54S & perhitungan luas hektar (ha) akurat.
6. <b>Geoportal Resmi Indonesia</b>: Terkoneksi langsung ke WMS BIG (RBI), ATR/BPN (GISTARU), BNPB (InaRISK), dan ESDM.
`;
    return sendMessage(chatId, guide, getMainKeyboard());
  }

  // 4. MENU UPLOAD SHP/GEOJSON DARI KEYBOARD
  if (text === "📂 Upload Shapefile / GeoJSON") {
    return promptUploadInstructions(chatId);
  }

  // 5. Shorthand Parsing -> LANGSUNG PROSES!
  for (const [toolId, tool] of Object.entries(TOOLS_REGISTRY)) {
    const cmd1 = `/${toolId}`;
    if (text.toLowerCase().startsWith(cmd1 + " ")) {
      const q = text.slice(cmd1.length).trim();
      userSessions.set(chatId, { toolId: toolId, toolName: tool.name, category: tool.cat, icon: tool.icon });
      return handleSmartSearchInput(chatId, q);
    }
  }

  // Alias Tambahan untuk Shorthand Bahasa Indonesia
  if (text.startsWith("/kelerengan ") || text.startsWith("/slope ")) {
    const q = text.replace("/kelerengan", "").replace("/slope", "").trim();
    userSessions.set(chatId, { toolId: "slope", toolName: TOOLS_REGISTRY.slope.name, category: "analysis", icon: "📐" });
    return handleSmartSearchInput(chatId, q);
  }
  if (text.startsWith("/drainase ") || text.startsWith("/hydro ")) {
    const q = text.replace("/drainase", "").replace("/hydro", "").trim();
    userSessions.set(chatId, { toolId: "hydro", toolName: TOOLS_REGISTRY.hydro.name, category: "analysis", icon: "🌊" });
    return handleSmartSearchInput(chatId, q);
  }
  if (text.startsWith("/bencana ") || text.startsWith("/hazard ")) {
    const q = text.replace("/bencana", "").replace("/hazard", "").trim();
    userSessions.set(chatId, { toolId: "hazard", toolName: TOOLS_REGISTRY.hazard.name, category: "analysis", icon: "🚨" });
    return handleSmartSearchInput(chatId, q);
  }
  if (text.startsWith("/suhu ") || text.startsWith("/lst ")) {
    const q = text.replace("/suhu", "").replace("/lst", "").trim();
    userSessions.set(chatId, { toolId: "lst", toolName: TOOLS_REGISTRY.lst.name, category: "analysis", icon: "🌡️" });
    return handleSmartSearchInput(chatId, q);
  }
  if (text.startsWith("/satelit ") || text.startsWith("/citra ")) {
    const q = text.replace("/satelit", "").replace("/citra", "").trim();
    userSessions.set(chatId, { toolId: "sentinel2", toolName: TOOLS_REGISTRY.sentinel2.name, category: "sat", icon: "🛰️" });
    return handleSmartSearchInput(chatId, q);
  }

  // 6. Deteksi Session State: User sedang mengetik wilayah -> LANGSUNG PROSES!
  const session = userSessions.get(chatId);
  if (session && session.step === "AWAITING_REGION" && text) {
    return handleSmartSearchInput(chatId, text);
  }

  // 7. Default: Jika user mengetik nama wilayah langsung tanpa klik tombol
  userSessions.set(chatId, { toolId: "sentinel2", toolName: TOOLS_REGISTRY.sentinel2.name, category: "sat", icon: "🛰️" });
  return handleSmartSearchInput(chatId, text);
}

/**
 * Polling Loop for SpatialEngineBot
 */
async function startSpatialPolling() {
  console.log("🚀 SpatialEngineBot v5.6 (Instant Execution + Dedicated Upload UI) Aktif!");
  console.log(`🔑 Bot Token: ${BOT_TOKEN.slice(0, 10)}...`);

  let offset = 0;
  while (true) {
    try {
      const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          if (update.callback_query) {
            handleCallbackQuery(update.callback_query).catch(console.error);
          } else if (update.message) {
            handleMessage(update.message).catch(console.error);
          }
        }
      }
    } catch (err) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

startSpatialPolling();
