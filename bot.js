const fs = require("fs");
const path = require("path");
const net = require("net");
const { exec } = require("child_process");
const dotenv = require("dotenv");
const { scrapePlaces, generateExportFiles, getCachedFiles } = require("./scraper");
const { createKavlingPackage } = require("./kavling_reporter");
const {
  resolveBoundingBox,
  generateUniversalGeoTIFF,
} = require("./raster_engine");
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

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8653915086:AAGcj0Plb9glaAkJRw57HZsVP-5yilOFVk4";
let ADMIN_ID = process.env.TELEGRAM_ADMIN_CHAT_ID ? String(process.env.TELEGRAM_ADMIN_CHAT_ID).trim() : "8437587674";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Send message to Telegram chat with optional Reply / Inline Keyboard
 */
async function sendMessage(chatId, text, replyMarkup = null, parseMode = "HTML") {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

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
 * Answer Callback Query to dismiss loading state on inline buttons
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
 * Send photo to Telegram chat
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
      "screenshot.png"
    );
    if (replyMarkup) {
      formData.append("reply_markup", JSON.stringify(replyMarkup));
    }

    const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: "POST",
      body: formData,
    });
    return await res.json();
  } catch (err) {
    console.error("Error sending Telegram photo:", err);
  }
}

/**
 * Send document to Telegram chat
 */
async function sendDocument(chatId, filePath, caption = "") {
  try {
    if (!fs.existsSync(filePath)) {
      return sendMessage(chatId, "⚠️ File tidak ditemukan.");
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
    formData.append(
      "document",
      new Blob([fileBuffer]),
      fileName
    );

    const res = await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: "POST",
      body: formData,
    });
    return await res.json();
  } catch (err) {
    console.error(`Error sending document ${filePath}:`, err);
  }
}

/**
 * Persistent Bottom Menu Keyboard
 */
function getMainKeyboard() {
  return {
    keyboard: [
      [{ text: "🛰️ Download Citra & DEM (.TIF)" }, { text: "📊 Analisis Spasial & Bencana" }],
      [{ text: "🌐 Data Global & Iklim (OpenSource)" }, { text: "📐 Laporan IMB & Kavling" }],
      [{ text: "📍 Scrape Google Maps" }, { text: "📡 Radar Bisnis Sekitar (GPS)" }],
      [{ text: "📸 Screenshot PC & Peta" }, { text: "📊 Laporan Sales & Omset" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Send PyQGIS command to QGIS Socket Server (port 9876)
 */
function sendToQgis(script) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let responseData = "";

    client.setTimeout(12000);

    client.connect(9876, "localhost", () => {
      client.write(script + "\n__EOF__\n");
    });

    client.on("data", (data) => {
      responseData += data.toString();
    });

    client.on("end", () => {
      client.destroy();
      resolve(responseData.trim() || "✅ Eksekusi selesai di QGIS.");
    });

    client.on("timeout", () => {
      client.destroy();
      resolve("⚠️ Timeout: QGIS tidak merespon dalam 12 detik.");
    });

    client.on("error", (err) => {
      client.destroy();
      resolve(`❌ Gagal terhubung ke QGIS Bridge (Port 9876): ${err.message}`);
    });
  });
}

/**
 * Capture Desktop / QGIS Screenshot using PowerShell
 */
function captureScreenshot() {
  return new Promise((resolve, reject) => {
    const screenshotPath = path.join(__dirname, "temp_screenshot.png");
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
      $bitmap.Save('${screenshotPath.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose()
      $bitmap.Dispose()
    `;

    exec(`powershell -Command "${psScript.replace(/\n/g, " ")}"`, (err) => {
      if (err) return reject(err);
      try {
        const buffer = fs.readFileSync(screenshotPath);
        fs.unlinkSync(screenshotPath);
        resolve(buffer);
      } catch (readErr) {
        reject(readErr);
      }
    });
  });
}

/**
 * Read SaaS Orders and Revenue Report
 */
function getSaaSReport() {
  const ordersFile = path.join(__dirname, "..", "urban-tech-web", "data", "orders.json");
  if (!fs.existsSync(ordersFile)) {
    return "Belum ada data transaksi di sistem.";
  }

  try {
    const data = JSON.parse(fs.readFileSync(ordersFile, "utf-8"));
    const orders = Object.values(data);
    const paidOrders = orders.filter((o) => o.status === "PAID");
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

    let report = `📊 <b>LAPORAN REAL-TIME SAAS URBAN TECH</b>\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `💰 <b>Total Omset Lunas:</b> Rp ${totalRevenue.toLocaleString("id-ID")}\n`;
    report += `🛒 <b>Transaksi Lunas:</b> ${paidOrders.length} transaksi\n`;
    report += `📈 <b>Total Lead Masuk:</b> ${orders.length} order\n\n`;
    report += `<b>Daftar Transaksi Terbaru:</b>\n`;

    const recent = orders.slice(-5).reverse();
    recent.forEach((o, idx) => {
      const icon = o.status === "PAID" ? "✅ LUNAS" : "⏳ PENDING";
      report += `<b>${idx + 1}. ${o.productName}</b>\n`;
      report += `   • Status: <b>${icon}</b> (Rp ${(o.amount || 0).toLocaleString("id-ID")})\n`;
      report += `   • Pembeli: ${o.customerName} (${o.customerEmail})\n`;
      if (o.license?.licenseKey) {
        report += `   • Lisensi: <code>${o.license.licenseKey}</code>\n`;
      }
      report += `\n`;
    });

    return report;
  } catch (err) {
    return `Gagal membaca database orders: ${err.message}`;
  }
}

/**
 * Compact Scraper Execution with Interactive Inline Action Buttons
 */
async function handleScraperCommand(chatId, query, limit = 20) {
  await sendMessage(
    chatId,
    `⚡ <b>Mengekstrak Google Maps:</b> <i>"${query}"</i> (${limit} data)...`
  );

  try {
    const data = await scrapePlaces(query, limit);

    if (!data || data.length === 0) {
      return sendMessage(chatId, `❌ Maaf, tidak ditemukan data tempat untuk kata kunci "${query}".`, getMainKeyboard());
    }

    const files = await generateExportFiles(query, data);

    // Auto-load ke QGIS Desktop
    const loadQgisScript = `
layer = QgsVectorLayer("${files.geojsonPath.replace(/\\/g, "/")}", "${query.replace(/"/g, '')}", "ogr")
if layer.isValid():
    QgsProject.instance().addMapLayer(layer)
    iface.setActiveLayer(layer)
    iface.zoomToActiveLayer()
    iface.mapCanvas().refresh()
`;
    sendToQgis(loadQgisScript).catch(() => {});

    const avgRating = (data.reduce((sum, p) => sum + p.rating, 0) / data.length).toFixed(1);
    const cardText = `
📍 <b>HASIL SCRAPING GMAPS: ${query.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━━
✅ <b>Jumlah Data:</b> <b>${data.length} Titik Lokasi</b>
⭐ <b>Rata-rata Rating:</b> ⭐ ${avgRating} / 5.0
📞 <b>Kontak Ditemukan:</b> ${data.length} No. Telepon/WA
🗺️ <b>Canvas QGIS:</b> Layer Otomatis Dimuat ke PC
━━━━━━━━━━━━━━━━━━━━━
<b>Pilih format file yang ingin Anda unduh:</b>
`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📊 Unduh Excel (.xlsx)", callback_data: `dl_xlsx:${files.cacheId}` },
          { text: "📄 Unduh CSV (.csv)", callback_data: `dl_csv:${files.cacheId}` },
        ],
        [
          { text: "🗺️ Unduh GeoJSON", callback_data: `dl_geojson:${files.cacheId}` },
          { text: "🌐 WebGIS Dashboard (.html)", callback_data: `dl_html:${files.cacheId}` },
        ],
        [
          { text: "📦 Download Semua (1 File .ZIP)", callback_data: `dl_zip:${files.cacheId}` },
        ],
        [
          { text: "📸 Screenshot Peta di PC", callback_data: `act_screen` },
          { text: "🔍 Zoom Canvas QGIS", callback_data: `act_zoom` },
        ],
      ],
    };

    return sendMessage(chatId, cardText, inlineKeyboard);
  } catch (err) {
    console.error("Scraper Command Error:", err);
    return sendMessage(chatId, `❌ Terjadi kesalahan: ${err.message}`, getMainKeyboard());
  }
}

/**
 * Handle Formal IMB & Kavling Report Generator
 */
async function handleKavlingCommand(chatId, input) {
  await sendMessage(chatId, "📐 <i>Menghubungkan ke citra satelit & menyusun Laporan Formal IMB...</i>");

  try {
    const pkg = await createKavlingPackage(input);
    const { reportData, dxfPath, htmlPath, satImagePath, satBuffer } = pkg;

    const summary = `
🏛️ <b>LAPORAN REKOMENDASI TEKNIS IMB / PBG</b>
━━━━━━━━━━━━━━━━━━━━━
📋 <b>No. Registrasi:</b> <code>REG-PBG-${reportData.noRegistrasi}</code>
👤 <b>Pemohon:</b> ${reportData.namaPemohon}
📍 <b>Lokasi:</b> ${reportData.lokasi}
━━━━━━━━━━━━━━━━━━━━━
📏 <b>Dimensi Kavling:</b> <b>${reportData.panjang}m x ${reportData.lebar}m</b>
📐 <b>Luas Tanah:</b> <b>${reportData.luasTanah} m²</b>
🏢 <b>Luas Tapak Bangunan (KDB ${reportData.kdbPersen}%):</b> <b>Maks. ${reportData.luasTapakMaks} m²</b>
🏬 <b>Total Luas Lantai (KLB ${reportData.klbAngka}):</b> <b>Maks. ${reportData.luasLantaiMaks} m²</b>
🚧 <b>Garis Sempadan (GSB):</b> <b>${reportData.gsbMeter} Meter</b> dari As Jalan
🌳 <b>Area Resapan Air (RTH 15%):</b> <b>Min. ${reportData.rthMinimun} m²</b>
━━━━━━━━━━━━━━━━━━━━━
✅ <b>STATUS: MEMENUHI SYARAT TEKNIS (FEASIBLE)</b>

<i>Mengirimkan Citra Satelit Tampak Atas, Berkas Laporan Resmi (.HTML Siap Cetak/PDF), dan Rancangan CAD (.DXF)...</i>
`;

    await sendMessage(chatId, summary);

    // Kirim Foto Citra Satelit Tampak Atas
    if (satBuffer || (satImagePath && fs.existsSync(satImagePath))) {
      try {
        const imgBuffer = satBuffer || fs.readFileSync(satImagePath);
        await sendPhoto(
          chatId,
          imgBuffer,
          `🛰️ <b>PETA CITRA SATELIT TAMPAK ATAS (SITE PLAN)</b>\n📍 Koordinat: <code>${reportData.lat}, ${reportData.lon}</code>\nDimensi: ${reportData.panjang}m x ${reportData.lebar}m (Luas: ${reportData.luasTanah} m²)`
        );
      } catch (photoErr) {
        console.warn("Photo send error:", photoErr.message);
      }
    }

    // Kirim Laporan Formal HTML
    await sendDocument(
      chatId,
      htmlPath,
      `📄 <b>LEMBAR LAPORAN FORMAL IMB/PBG</b>\nFormat A4 resmi lengkap dengan Citra Satelit, KOP & tanda tangan (buka di browser & klik Print ke PDF).`
    );

    // Kirim File CAD DXF
    await sendDocument(
      chatId,
      dxfPath,
      `📐 <b>FILE RANCANGAN TAPAK AUTOCAD (.DXF)</b>\nLayer batas kavling, offset sempadan GSB, dan teks dimensi siap edit di AutoCAD/SketchUp.`
    );

    return sendMessage(
      chatId,
      `✅ <b>Semua berkas pengajuan IMB/PBG telah siap!</b>\nDokumen sudah memenuhi kaidah Peraturan Tata Ruang (RDTR/KRK).`,
      getMainKeyboard()
    );
  } catch (err) {
    console.error("Kavling Report Error:", err);
    return sendMessage(chatId, `❌ Gagal membuat laporan kavling: ${err.message}`, getMainKeyboard());
  }
}

/**
 * Handle GPS Location Share from User (Local Business & Competitor Radar)
 */
async function handleLocationShare(chatId, lat, lon) {
  await sendMessage(
    chatId,
    `📡 <b>RADAR INTELIJEN BISNIS SEKITAR (GPS AKTIF)</b>\n━━━━━━━━━━━━━━━━━━━━━\n📍 <b>Titik Koordinat:</b> <code>${lat.toFixed(5)}, ${lon.toFixed(5)}</code>\n🔍 <i>Memindai aktivitas bisnis dalam radius 2 KM...</i>`
  );

  const query = `tempat bisnis di sekitar ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  return handleScraperCommand(chatId, query, 20);
}

/**
 * 🛰️ STEP 1: Pilih Provinsi / Wilayah Utama
 */
async function handleRasterProvinceMenu(chatId) {
  const promptText = `
🛰️ <b>SATELLITE & DEM GEOTIFF DOWNLOADER</b>
━━━━━━━━━━━━━━━━━━━━━
Unduh citra satelit resolusi tinggi & data elevasi topografi (DEM/DSM) format <b>GeoTIFF (.TIF)</b> siap olah di QGIS / ArcGIS / AutoCAD.

<b>Pilih Provinsi / Wilayah Studi atau Ketik Langsung:</b>
<i>Contoh ketik bebas: <code>/citra Wonosobo</code> atau <code>/dem Merapi</code></i>
`;
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "🏛️ Jawa Tengah", callback_data: "rst_prov:Jawa Tengah" },
        { text: "🏙️ DKI Jakarta & Jabar", callback_data: "rst_prov:Jawa Barat" },
      ],
      [
        { text: "🌋 DI Yogyakarta", callback_data: "rst_prov:DI Yogyakarta" },
        { text: "🌆 Jawa Timur", callback_data: "rst_prov:Jawa Timur" },
      ],
      [
        { text: "🏝️ Bali & NTB", callback_data: "rst_prov:Bali" },
        { text: "🌲 IKN & Kaltim", callback_data: "rst_prov:Kalimantan Timur" },
      ],
      [
        { text: "🌴 Sumatera Utara", callback_data: "rst_prov:Sumatera Utara" },
        { text: "🌊 Sulawesi Selatan", callback_data: "rst_prov:Sulawesi Selatan" },
      ],
    ],
  };
  return sendMessage(chatId, promptText, inlineKeyboard);
}

/**
 * 🏙️ STEP 2: Pilih Kota / Kabupaten Berdasarkan Provinsi
 */
async function handleRasterCityMenu(chatId, provName) {
  const provCities = {
    "Jawa Tengah": ["Kota Semarang", "Kabupaten Tegal", "Surakarta (Solo)", "Banyumas (Purwokerto)", "Magelang", "Kudus", "Wonosobo", "Pekalongan"],
    "Jawa Barat": ["Kota Bandung", "Kabupaten Bogor", "Bekasi", "Depok", "Cirebon", "Sukabumi"],
    "DI Yogyakarta": ["Kota Yogyakarta", "Kabupaten Sleman", "Bantul", "Gunungkidul", "Kulon Progo", "Gunung Merapi"],
    "Jawa Timur": ["Kota Surabaya", "Malang", "Banyuwangi", "Jember", "Sidoarjo", "Kediri", "Gunung Bromo"],
    "Bali": ["Kota Denpasar", "Badung (Kuta)", "Gianyar (Ubud)", "Buleleng", "Tabanan"],
    "Kalimantan Timur": ["Kawasan Inti IKN", "Kota Balikpapan", "Samarinda", "Kutai Kartanegara"],
    "Sumatera Utara": ["Kota Medan", "Deli Serdang", "Danau Toba", "Pematangsiantar"],
    "Sulawesi Selatan": ["Kota Makassar", "Gowa", "Maros", "Toraja"],
  };

  const cities = provCities[provName] || ["Kota Semarang", "Surabaya", "Bandung", "Medan"];
  const buttons = [];
  for (let i = 0; i < cities.length; i += 2) {
    const row = [{ text: cities[i], callback_data: `rst_city:${encodeURIComponent(cities[i])}` }];
    if (cities[i + 1]) {
      row.push({ text: cities[i + 1], callback_data: `rst_city:${encodeURIComponent(cities[i + 1])}` });
    }
    buttons.push(row);
  }

  const prompt = `📍 <b>PROVINSI: ${provName.toUpperCase()}</b>\nPilih Kota/Kabupaten atau ketik nama daerah yang Anda inginkan:`;
  return sendMessage(chatId, prompt, { inline_keyboard: buttons });
}

/**
 * 📏 STEP 3: Pilih Resolusi Dimensi Raster (Pixel Dimension)
 */
async function handleRasterResMenu(chatId, regionName) {
  const prompt = `
📍 <b>WILAYAH: ${regionName.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Pilih Tingkat Resolusi Citra / Ukuran Grid Pixel:</b>
`;
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "📱 Standard HD (1024 x 768 px)", callback_data: `rst_res:hd:${encodeURIComponent(regionName)}` },
      ],
      [
        { text: "🖥️ Full HD 1080p (1920 x 1080 px)", callback_data: `rst_res:fhd:${encodeURIComponent(regionName)}` },
      ],
      [
        { text: "🚀 Ultra 2K (2048 x 1536 px)", callback_data: `rst_res:2k:${encodeURIComponent(regionName)}` },
      ],
      [
        { text: "💎 Super 4K (3072 x 2304 px)", callback_data: `rst_res:4k:${encodeURIComponent(regionName)}` },
      ],
    ],
  };
  return sendMessage(chatId, prompt, inlineKeyboard);
}

/**
 * 🛰️ STEP 4: Katalog Lengkap 9 Sensor Citra & DEM/DSM
 */
async function handleRasterSensorMenu(chatId, regionName, resOpt = "hd") {
  await sendMessage(chatId, `🔍 <i>Menganalisis batas spasial "${regionName}"...</i>`);

  try {
    const bbox = await resolveBoundingBox(regionName);
    const resLabels = { sd: "512px", hd: "1024px", fhd: "1080p", "2k": "2K", "4k": "4K" };
    const resLabel = resLabels[resOpt] || "HD";

    const prompt = `
📍 <b>WILAYAH: ${bbox.name}</b>
📐 <b>Resolusi:</b> ${resLabel} • <b>Cakupan:</b> ~${(bbox.widthMeters / 1000).toFixed(1)} KM
━━━━━━━━━━━━━━━━━━━━━
<b>Pilih Sensor / Jenis Citra GeoTIFF (.TIF):</b>
`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "🛰️ Citra Satelit Optik HD (0.3m RGB)", callback_data: `rst_gen:vhr_optik:${resOpt}:${encodeURIComponent(regionName)}` },
        ],
        [
          { text: "🇪🇺 Sentinel-2 L2A (10m Multispektral)", callback_data: `rst_gen:sentinel2:${resOpt}:${encodeURIComponent(regionName)}` },
          { text: "🇺🇸 Landsat 8/9 OLI (15m Natural)", callback_data: `rst_gen:landsat:${resOpt}:${encodeURIComponent(regionName)}` },
        ],
        [
          { text: "⛰️ DEM Topografi SRTM (Bare Earth)", callback_data: `rst_gen:dem:${resOpt}:${encodeURIComponent(regionName)}` },
          { text: "🏢 DSM Surface (Bangunan & Pohon)", callback_data: `rst_gen:dsm:${resOpt}:${encodeURIComponent(regionName)}` },
        ],
        [
          { text: "📡 Radar ALOS PALSAR / SAR (12.5m)", callback_data: `rst_gen:sar_radar:${resOpt}:${encodeURIComponent(regionName)}` },
          { text: "🌑 Hillshade 3D Shaded Relief", callback_data: `rst_gen:hillshade:${resOpt}:${encodeURIComponent(regionName)}` },
        ],
        [
          { text: "🌿 NDVI Kerapatan Vegetasi (Hijau)", callback_data: `rst_gen:ndvi:${resOpt}:${encodeURIComponent(regionName)}` },
          { text: "🏙️ NDBI Lahan Terbangun (Merah)", callback_data: `rst_gen:ndbi:${resOpt}:${encodeURIComponent(regionName)}` },
        ],
        [
          { text: "🗺️ Tutupan Lahan Tematik (Full Color)", callback_data: `rst_gen:landcover:${resOpt}:${encodeURIComponent(regionName)}` },
        ],
      ],
    };

    return sendMessage(chatId, prompt, inlineKeyboard);
  } catch (err) {
    console.error("Sensor Menu Error:", err);
    return sendMessage(chatId, `❌ Gagal memuat sensor: ${err.message}`, getMainKeyboard());
  }
}

/**
 * 🚀 STEP 5: Generate GeoTIFF, World Files (.TFW + .PRJ) & Inject ke QGIS Desktop
 */
async function handleRasterGeneration(chatId, sensorType, regionName, resOpt = "hd") {
  await sendMessage(
    chatId,
    `⚙️ <b>Memproses GeoTIFF Sensor:</b> <code>${sensorType.toUpperCase()}</code>\n📍 Wilayah: <i>"${regionName}"</i>\n🛰️ Mengunduh data & menyematkan proyeksi EPSG:4326 + World File (.tfw/.prj)...`
  );

  try {
    const bbox = await resolveBoundingBox(regionName);
    const result = await generateUniversalGeoTIFF(regionName, bbox, sensorType, resOpt);

    // Kirim PyQGIS Script ke QGIS Bridge (100% Anti-Error Unnamed CRS)
    const loadQgisScript = `
import os
tif_path = r"${result.tifPath.replace(/\\/g, "/")}"
rlayer = QgsRasterLayer(tif_path, "${regionName} - ${result.type}", "gdal")
if rlayer.isValid():
    if not rlayer.crs().isValid() or rlayer.crs().authid() == "" or "USER" in rlayer.crs().authid():
        rlayer.setCrs(QgsCoordinateReferenceSystem("EPSG:4326"))
    QgsProject.instance().addMapLayer(rlayer)
    iface.setActiveLayer(rlayer)
    iface.zoomToActiveLayer()
    iface.mapCanvas().refresh()
    print("Layer berhasil dimuat ke QGIS dengan EPSG:4326")
`;
    sendToQgis(loadQgisScript).catch(() => {});

    // 1. Kirim Foto Preview Visual
    if (fs.existsSync(result.previewPngPath)) {
      const imgBuffer = fs.readFileSync(result.previewPngPath);
      await sendPhoto(
        chatId,
        imgBuffer,
        `🖼️ <b>PREVIEW VISUALISASI RASTER: ${result.type.toUpperCase()}</b>\n📍 Wilayah: <b>${bbox.name}</b>`
      );
    }

    // 2. Kirim Dokumen Asli GeoTIFF (.TIF)
    let metaCaption = `🛰️ <b>FILE GEOTIFF RASTER (.TIF) RESMI</b>\n`;
    metaCaption += `━━━━━━━━━━━━━━━━━━━━━\n`;
    metaCaption += `• <b>Jenis:</b> ${result.type}\n`;
    metaCaption += `• <b>Format:</b> ${result.format} + .TFW & .PRJ\n`;
    metaCaption += `• <b>CRS Koordinat:</b> <code>${result.crs}</code> (WGS 84)\n`;
    metaCaption += `• <b>Resolusi Spasial:</b> ${result.resolution}\n`;
    metaCaption += `• <b>Dimensi Grid:</b> ${result.width} x ${result.height} px\n`;
    if (result.minElevation) {
      metaCaption += `• <b>Rentang Elevasi:</b> ${result.minElevation} s/d ${result.maxElevation} (Rata-rata: ${result.avgElevation})\n`;
    }
    metaCaption += `• <b>Ukuran File:</b> ${result.fileSizeMb} MB\n`;
    metaCaption += `━━━━━━━━━━━━━━━━━━━━━\n`;
    metaCaption += `💻 <i>Layer otomatis dimuat ke QGIS Desktop di laptop Anda (Koordinat Presisi EPSG:4326)!</i>`;

    await sendDocument(chatId, result.tifPath, metaCaption);

    return sendMessage(
      chatId,
      `✅ <b>GeoTIFF berhasil dikirim & dimuat ke QGIS!</b>\nMetadata spasial lengkap (EPSG:4326) memastikan koordinat langsung pas dengan basemap tanpa error transformasi.`,
      getMainKeyboard()
    );
  } catch (err) {
    console.error("Raster Generation Error:", err);
    return sendMessage(chatId, `❌ Gagal menghasilkan GeoTIFF: ${err.message}`, getMainKeyboard());
  }
}

/**
 * 📊 ANALISIS SPASIAL & KEBENCANAAN MENU
 */
async function handleAnalysisMenu(chatId, regionQuery = "") {
  const query = regionQuery.trim();

  if (!query) {
    const promptText = `
📊 <b>ADVANCED SPATIAL & HAZARD RISK ANALYSIS</b>
━━━━━━━━━━━━━━━━━━━━━
Pilih jenis analisis spasial lanjutan untuk perencanaan wilayah, hidrologi, dan mitigasi bencana:

<b>Pilih preset wilayah cepat atau ketik nama daerah:</b>
<i>Contoh: <code>/kelerengan Semarang</code> atau <code>/bencana Merapi</code></i>
`;
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "🏙️ Kota Semarang", callback_data: "spa_q:Kota Semarang" },
          { text: "🏛️ Kab. Tegal", callback_data: "spa_q:Kabupaten Tegal" },
        ],
        [
          { text: "🌋 G. Merapi & Sleman", callback_data: "spa_q:Gunung Merapi" },
          { text: "⛰️ Bandung Raya", callback_data: "spa_q:Bandung" },
        ],
        [
          { text: "🌲 Kawasan Inti IKN", callback_data: "spa_q:Kawasan Inti IKN" },
          { text: "🌊 Bali Selatan", callback_data: "spa_q:Denpasar Bali" },
        ],
      ],
    };
    return sendMessage(chatId, promptText, inlineKeyboard);
  }

  await sendMessage(chatId, `🔍 <i>Menganalisis batas spasial wilayah "${query}"...</i>`);

  try {
    const bbox = await resolveBoundingBox(query);
    const prompt = `
📍 <b>WILAYAH STUDI: ${bbox.name}</b>
📐 <b>Cakupan:</b> ~${(bbox.widthMeters / 1000).toFixed(1)} KM
━━━━━━━━━━━━━━━━━━━━━
<b>Pilih Jenis Analisis Spasial & Kebencanaan:</b>
`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "⛰️ Analisis Kelerengan (Standar Permen PU)", callback_data: `spa_do:slope:${encodeURIComponent(query)}` },
        ],
        [
          { text: "🌊 Arah Aliran Air & Drainase Alami", callback_data: `spa_do:hydro:${encodeURIComponent(query)}` },
        ],
        [
          { text: "🚨 Peta Kebencanaan Multirisiko (InaRISK)", callback_data: `spa_do:hazard:${encodeURIComponent(query)}` },
        ],
        [
          { text: "🌡️ Suhu Lahan & Pulau Panas (LST Thermal)", callback_data: `spa_do:lst:${encodeURIComponent(query)}` },
        ],
      ],
    };

    return sendMessage(chatId, prompt, inlineKeyboard);
  } catch (err) {
    console.error("Analysis Menu Error:", err);
    return sendMessage(chatId, `❌ Gagal memproses menu analisis: ${err.message}`, getMainKeyboard());
  }
}

/**
 * 🚀 EXECUTE SPATIAL ANALYSIS & DELIVER TO USER & QGIS
 */
async function handleSpatialAnalysisExecution(chatId, type, regionName) {
  await sendMessage(
    chatId,
    `⚙️ <b>Menjalankan Analisis Spasial:</b> <code>${type.toUpperCase()}</code>\n📍 Wilayah: <i>"${regionName}"</i>\n📐 Memproses pemodelan raster geomorfologi & menyematkan referensi spasial...`
  );

  try {
    const bbox = await resolveBoundingBox(regionName);
    let result = null;

    if (type === "slope") {
      result = await generateSlopeAnalysis(regionName, bbox, "hd");
    } else if (type === "hydro") {
      result = await generateHydrologyDrainage(regionName, bbox, "hd");
    } else if (type === "hazard") {
      result = await generateMultiHazardAnalysis(regionName, bbox, "hd");
    } else if (type === "lst") {
      result = await generateLstThermalAnalysis(regionName, bbox, "hd");
    }

    if (!result) throw new Error("Tipe analisis tidak dikenal");

    // Injeksi Layer ke QGIS Desktop
    const loadQgisScript = `
import os
tif_path = r"${result.tifPath.replace(/\\/g, "/")}"
rlayer = QgsRasterLayer(tif_path, "${regionName} - ${result.type}", "gdal")
if rlayer.isValid():
    if not rlayer.crs().isValid() or rlayer.crs().authid() == "" or "USER" in rlayer.crs().authid():
        rlayer.setCrs(QgsCoordinateReferenceSystem("EPSG:4326"))
    QgsProject.instance().addMapLayer(rlayer)
    iface.setActiveLayer(rlayer)
    iface.zoomToActiveLayer()
    iface.mapCanvas().refresh()
    print("Analisis berhasil dimuat ke QGIS!")
`;
    sendToQgis(loadQgisScript).catch(() => {});

    // 1. Kirim Foto Visual Preview
    if (fs.existsSync(result.previewPngPath)) {
      const imgBuffer = fs.readFileSync(result.previewPngPath);
      await sendPhoto(
        chatId,
        imgBuffer,
        `📊 <b>HASIL ANALISIS: ${result.type.toUpperCase()}</b>\n📍 Wilayah: <b>${bbox.name}</b>`
      );
    }

    // 2. Kirim Dokumen Asli GeoTIFF & Ringkasan Metrik
    let metaCaption = `📐 <b>HASIL PEMODELAN SPASIAL (${result.type.toUpperCase()})</b>\n`;
    metaCaption += `━━━━━━━━━━━━━━━━━━━━━\n`;
    metaCaption += `• <b>Format:</b> ${result.format} + .TFW + .PRJ\n`;
    metaCaption += `• <b>CRS:</b> <code>${result.crs}</code>\n`;
    metaCaption += `• <b>Resolusi:</b> ${result.resolution}\n`;

    if (result.stats) {
      metaCaption += `\n📊 <b>Distribusi Kelas Kelerengan (Permen PU):</b>\n`;
      metaCaption += `  🟩 Kelas 1 (0-8% Datar): <b>${result.stats.class1Pct}%</b>\n`;
      metaCaption += `  🟨 Kelas 2 (8-15% Landai): <b>${result.stats.class2Pct}%</b>\n`;
      metaCaption += `  🟧 Kelas 3 (15-25% Agak Curam): <b>${result.stats.class3Pct}%</b>\n`;
      metaCaption += `  🟥 Kelas 4 (25-45% Curam): <b>${result.stats.class4Pct}%</b>\n`;
      metaCaption += `  🟪 Kelas 5 (>45% Sangat Curam): <b>${result.stats.class5Pct}%</b>\n`;
    }

    if (result.riskStats) {
      metaCaption += `\n🚨 <b>Evaluasi Risiko Kebencanaan:</b>\n`;
      metaCaption += `  🛡️ Zona Aman Relatif: <b>${result.riskStats.amanPct}%</b>\n`;
      metaCaption += `  🌊 Zona Rawan Banjir/Rob: <b>${result.riskStats.banjirPct}%</b>\n`;
      metaCaption += `  ⚠️ Zona Kerentanan Longsor: <b>${result.riskStats.longsorPct}%</b>\n`;
      metaCaption += `  ⚡ Zona Kerentanan Sedang: <b>${result.riskStats.sedangPct}%</b>\n`;
    }

    if (result.tempStats) {
      metaCaption += `\n🌡️ <b>Distribusi Suhu Permukaan Lahan (LST):</b>\n`;
      metaCaption += `  • Suhu Minimum: <b>${result.tempStats.min}</b> (Area RTH/Bukit)\n`;
      metaCaption += `  • Suhu Rata-rata: <b>${result.tempStats.avg}</b>\n`;
      metaCaption += `  • Suhu Maksimum: <b>${result.tempStats.max}</b> (Urban Heat Island)\n`;
    }

    if (result.streamLengthEstimate) {
      metaCaption += `\n〰️ <b>Total Jaringan Aliran Air Utama:</b> ~${result.streamLengthEstimate}\n`;
    }

    metaCaption += `━━━━━━━━━━━━━━━━━━━━━\n`;
    metaCaption += `💻 <i>Layer otomatis dimuat ke QGIS Desktop di laptop Anda!</i>`;

    await sendDocument(chatId, result.tifPath, metaCaption);

    return sendMessage(
      chatId,
      `✅ <b>Analisis Spasial Berhasil Diproses!</b>\nFormat GeoTIFF berstandar kartografis siap olah di QGIS Desktop.`,
      getMainKeyboard()
    );
  } catch (err) {
    console.error("Spatial Exec Error:", err);
    return sendMessage(chatId, `❌ Gagal memproses analisis spasial: ${err.message}`, getMainKeyboard());
  }
}

/**
 * 🌐 OPEN-SOURCE GLOBAL DATA & CLIMATE MENU
 */
async function handleOpenDataMenu(chatId, regionQuery = "") {
  const query = regionQuery.trim();

  if (!query) {
    const promptText = `
🌐 <b>OPEN-SOURCE GLOBAL DATA & CLIMATE HUB</b>
━━━━━━━━━━━━━━━━━━━━━
Akses dataset spasial global terbuka berstandar internasional (Demografi, Iklim, Emisi, Lampu Malam, Tutupan Lahan & Energi Terbarukan):

<b>Pilih preset wilayah cepat atau ketik nama daerah:</b>
<i>Contoh: <code>/worldpop Semarang</code>, <code>/dynamicworld Bandung</code>, <code>/polusi Jakarta</code></i>
`;
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "🏙️ Kota Semarang", callback_data: "opn_q:Kota Semarang" },
          { text: "🏛️ Kab. Tegal", callback_data: "opn_q:Kabupaten Tegal" },
        ],
        [
          { text: "🌋 DI Yogyakarta", callback_data: "opn_q:DI Yogyakarta" },
          { text: "🌆 Surabaya", callback_data: "opn_q:Surabaya" },
        ],
        [
          { text: "🌲 Kawasan Inti IKN", callback_data: "opn_q:Kawasan Inti IKN" },
          { text: "🏙️ DKI Jakarta", callback_data: "opn_q:DKI Jakarta" },
        ],
      ],
    };
    return sendMessage(chatId, promptText, inlineKeyboard);
  }

  await sendMessage(chatId, `🔍 <i>Menganalisis repositori data spasial terbuka untuk wilayah "${query}"...</i>`);

  try {
    const bbox = await resolveBoundingBox(query);
    const prompt = `
📍 <b>WILAYAH STUDI: ${bbox.name}</b>
📐 <b>Cakupan Wilayah:</b> ~${(bbox.widthMeters / 1000).toFixed(1)} KM
━━━━━━━━━━━━━━━━━━━━━
<b>Pilih Dataset Global Terbuka (.TIF Berwarna Kartografi):</b>
`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "🌍 Dynamic World 10m (Google/WRI NRT)", callback_data: `opn_do:dw:${encodeURIComponent(query)}` },
        ],
        [
          { text: "🗺️ ESRI 10m Land Cover (2017-2024)", callback_data: `opn_do:esri:${encodeURIComponent(query)}` },
        ],
        [
          { text: "👥 Kepadatan Penduduk (WorldPop 100m)", callback_data: `opn_do:pop:${encodeURIComponent(query)}` },
          { text: "🌃 Lampu Malam Satelit (NASA VIIRS)", callback_data: `opn_do:viirs:${encodeURIComponent(query)}` },
        ],
        [
          { text: "🏭 Kronologi Kota (GHSL Epoch)", callback_data: `opn_do:ghsl:${encodeURIComponent(query)}` },
          { text: "🌲 Kanopi Hutan (GFW Hansen 30m)", callback_data: `opn_do:forest:${encodeURIComponent(query)}` },
        ],
        [
          { text: "🌬️ Polusi Udara NO2 (Sentinel-5P)", callback_data: `opn_do:s5p:${encodeURIComponent(query)}` },
          { text: "🌧️ Curah Hujan Isohyet (CHIRPS/ERA5)", callback_data: `opn_do:rain:${encodeURIComponent(query)}` },
        ],
        [
          { text: "☀️ Potensi Energi Surya (Global Solar)", callback_data: `opn_do:solar:${encodeURIComponent(query)}` },
        ],
      ],
    };

    return sendMessage(chatId, prompt, inlineKeyboard);
  } catch (err) {
    console.error("OpenData Menu Error:", err);
    return sendMessage(chatId, `❌ Gagal memproses menu data global: ${err.message}`, getMainKeyboard());
  }
}

/**
 * 🚀 EXECUTE OPEN-SOURCE GEO-DATA & DELIVER TO USER & QGIS
 */
async function handleOpenDataExecution(chatId, type, regionName) {
  await sendMessage(
    chatId,
    `⚙️ <b>Mengunduh Dataset Global:</b> <code>${type.toUpperCase()}</code>\n📍 Wilayah: <i>"${regionName}"</i>\n🛰️ Mengakses satelit global, memproses pewarnaan kartografi & menyematkan proyeksi EPSG:4326...`
  );

  try {
    const bbox = await resolveBoundingBox(regionName);
    let result = null;

    if (type === "pop") {
      result = await generateWorldPopDensity(regionName, bbox, "hd");
    } else if (type === "viirs") {
      result = await generateViirsNightLights(regionName, bbox, "hd");
    } else if (type === "ghsl") {
      result = await generateGhslBuiltupEpoch(regionName, bbox, "hd");
    } else if (type === "forest") {
      result = await generateForestCanopyCover(regionName, bbox, "hd");
    } else if (type === "s5p") {
      result = await generateSentinel5pAirQuality(regionName, bbox, "hd");
    } else if (type === "rain") {
      result = await generateChirpsRainfall(regionName, bbox, "hd");
    } else if (type === "solar") {
      result = await generateGlobalSolarAtlas(regionName, bbox, "hd");
    } else if (type === "dw") {
      result = await generateDynamicWorldLulc(regionName, bbox, "hd");
    } else if (type === "esri") {
      result = await generateEsriMultiYearLandCover(regionName, bbox, "hd");
    }

    if (!result) throw new Error("Tipe dataset global tidak dikenal");

    // Injeksi Layer ke QGIS Desktop
    const loadQgisScript = `
import os
tif_path = r"${result.tifPath.replace(/\\/g, "/")}"
rlayer = QgsRasterLayer(tif_path, "${regionName} - ${result.type}", "gdal")
if rlayer.isValid():
    if not rlayer.crs().isValid() or rlayer.crs().authid() == "" or "USER" in rlayer.crs().authid():
        rlayer.setCrs(QgsCoordinateReferenceSystem("EPSG:4326"))
    QgsProject.instance().addMapLayer(rlayer)
    iface.setActiveLayer(rlayer)
    iface.zoomToActiveLayer()
    iface.mapCanvas().refresh()
    print("Dataset global berhasil dimuat ke QGIS!")
`;
    sendToQgis(loadQgisScript).catch(() => {});

    // 1. Kirim Foto Visual Preview
    if (fs.existsSync(result.previewPngPath)) {
      const imgBuffer = fs.readFileSync(result.previewPngPath);
      await sendPhoto(
        chatId,
        imgBuffer,
        `🌐 <b>DATASET GLOBAL: ${result.type.toUpperCase()}</b>\n📍 Wilayah: <b>${bbox.name}</b>`
      );
    }

    // 2. Kirim Dokumen Asli GeoTIFF & Ringkasan Metrik
    let metaCaption = `🌐 <b>FILE DATASET GLOBAL (.TIF) RESMI</b>\n`;
    metaCaption += `━━━━━━━━━━━━━━━━━━━━━\n`;
    metaCaption += `• <b>Dataset:</b> ${result.type}\n`;
    metaCaption += `• <b>Format:</b> ${result.format} + .TFW + .PRJ\n`;
    metaCaption += `• <b>CRS:</b> <code>${result.crs}</code>\n`;
    metaCaption += `• <b>Resolusi:</b> ${result.resolution}\n`;

    if (result.stats) {
      metaCaption += `\n📊 <b>Informasi & Analisis Statistik Spasial:</b>\n`;
      for (const [k, v] of Object.entries(result.stats)) {
        metaCaption += `  • <b>${k.toUpperCase()}:</b> ${v}\n`;
      }
    }

    metaCaption += `━━━━━━━━━━━━━━━━━━━━━\n`;
    metaCaption += `💻 <i>Layer otomatis dimuat ke QGIS Desktop di laptop Anda!</i>`;

    await sendDocument(chatId, result.tifPath, metaCaption);

    return sendMessage(
      chatId,
      `✅ <b>Dataset Global Berhasil Diterbitkan!</b>\nFormat GeoTIFF berstandar kartografis siap untuk analisis sosial-ekonomi, tata ruang & iklim.`,
      getMainKeyboard()
    );
  } catch (err) {
    console.error("OpenData Exec Error:", err);
    return sendMessage(chatId, `❌ Gagal memproses dataset global: ${err.message}`, getMainKeyboard());
  }
}

/**
 * Handle Telegram Callback Queries
 */
async function handleCallbackQuery(cq) {
  const cqId = cq.id;
  const chatId = cq.message.chat.id;
  const data = cq.data || "";

  // 0. Open-Source Global Data Callbacks
  if (data.startsWith("opn_q:")) {
    const reg = data.replace("opn_q:", "");
    await answerCallbackQuery(cqId, `Memilih: ${reg}`);
    return handleOpenDataMenu(chatId, reg);
  }

  if (data.startsWith("opn_do:")) {
    const parts = data.replace("opn_do:", "").split(":");
    const type = parts[0];
    const region = decodeURIComponent(parts[1] || "Semarang");
    await answerCallbackQuery(cqId, "Mengunduh dataset...");
    return handleOpenDataExecution(chatId, type, region);
  }

  // 1. Spatial Analysis Callbacks
  if (data.startsWith("spa_q:")) {
    const reg = data.replace("spa_q:", "");
    await answerCallbackQuery(cqId, `Memilih: ${reg}`);
    return handleAnalysisMenu(chatId, reg);
  }

  if (data.startsWith("spa_do:")) {
    const parts = data.replace("spa_do:", "").split(":");
    const type = parts[0];
    const region = decodeURIComponent(parts[1] || "Semarang");
    await answerCallbackQuery(cqId, "Menjalankan analisis...");
    return handleSpatialAnalysisExecution(chatId, type, region);
  }

  // 1. Wizard Raster Callbacks
  if (data.startsWith("rst_prov:")) {
    const prov = data.replace("rst_prov:", "");
    await answerCallbackQuery(cqId, `Provinsi: ${prov}`);
    return handleRasterCityMenu(chatId, prov);
  }

  if (data.startsWith("rst_city:")) {
    const city = decodeURIComponent(data.replace("rst_city:", ""));
    await answerCallbackQuery(cqId, `Kota: ${city}`);
    return handleRasterResMenu(chatId, city);
  }

  if (data.startsWith("rst_res:")) {
    const parts = data.replace("rst_res:", "").split(":");
    const resOpt = parts[0];
    const city = decodeURIComponent(parts[1] || "Semarang");
    await answerCallbackQuery(cqId, `Resolusi: ${resOpt.toUpperCase()}`);
    return handleRasterSensorMenu(chatId, city, resOpt);
  }

  if (data.startsWith("rst_gen:")) {
    const parts = data.replace("rst_gen:", "").split(":");
    const sensor = parts[0];
    const resOpt = parts[1] || "hd";
    const city = decodeURIComponent(parts[2] || "Semarang");
    await answerCallbackQuery(cqId, "Memproses GeoTIFF...");
    return handleRasterGeneration(chatId, sensor, city, resOpt);
  }

  // 1. Unduh Excel (.xlsx)
  if (data.startsWith("dl_xlsx:")) {
    const cacheId = data.replace("dl_xlsx:", "");
    const files = getCachedFiles(cacheId);
    if (files) {
      await answerCallbackQuery(cqId, "Mengirim file Excel...");
      return sendDocument(chatId, files.xlsxPath, `📊 <b>File Excel (.xlsx)</b> — ${files.query} (${files.totalCount} data)`);
    }
  }

  // 2. Unduh CSV (.csv)
  if (data.startsWith("dl_csv:")) {
    const cacheId = data.replace("dl_csv:", "");
    const files = getCachedFiles(cacheId);
    if (files) {
      await answerCallbackQuery(cqId, "Mengirim file CSV...");
      return sendDocument(chatId, files.csvPath, `📄 <b>File CSV (.csv)</b> — ${files.query}`);
    }
  }

  // 3. Unduh GeoJSON (.geojson)
  if (data.startsWith("dl_geojson:")) {
    const cacheId = data.replace("dl_geojson:", "");
    const files = getCachedFiles(cacheId);
    if (files) {
      await answerCallbackQuery(cqId, "Mengirim file GeoJSON...");
      return sendDocument(chatId, files.geojsonPath, `🗺️ <b>File GeoJSON (.geojson)</b> — ${files.query}`);
    }
  }

  // 4. Unduh WebGIS Dashboard (.html)
  if (data.startsWith("dl_html:")) {
    const cacheId = data.replace("dl_html:", "");
    const files = getCachedFiles(cacheId);
    if (files) {
      await answerCallbackQuery(cqId, "Mengirim WebGIS Dashboard...");
      return sendDocument(chatId, files.dashboardHtmlPath, `🌐 <b>WebGIS Dashboard (.html)</b>\nPeta interaktif Satelit & OSM.`);
    }
  }

  // 5. Download ZIP Bundle (.zip)
  if (data.startsWith("dl_zip:")) {
    const cacheId = data.replace("dl_zip:", "");
    const files = getCachedFiles(cacheId);
    if (files) {
      await answerCallbackQuery(cqId, "Mengirim paket ZIP...");
      return sendDocument(chatId, files.zipPath, `📦 <b>Paket Lengkap (.ZIP)</b> — ${files.query}\nBerisi: .xlsx + .csv + .geojson + WebGIS dashboard`);
    }
  }

  // 6. Screenshot Peta
  if (data === "act_screen") {
    await answerCallbackQuery(cqId, "Mengambil screenshot...");
    try {
      const buffer = await captureScreenshot();
      return sendPhoto(chatId, buffer, `🖥️ <b>Tangkapan Layar Live PC & Peta QGIS</b>`);
    } catch (e) {
      return sendMessage(chatId, `❌ Gagal mengambil screenshot: ${e.message}`);
    }
  }

  // 7. Zoom Canvas QGIS
  if (data === "act_zoom") {
    await answerCallbackQuery(cqId, "Menyesuaikan canvas...");
    const script = `
iface.zoomToActiveLayer()
iface.mapCanvas().refresh()
`;
    await sendToQgis(script);
    return sendMessage(chatId, "🔍 <b>Canvas QGIS berhasil difokuskan ke layer hasil scraping!</b>");
  }

  // 8. Preset Wizard
  if (data.startsWith("wiz_q:")) {
    const preset = data.replace("wiz_q:", "");
    await answerCallbackQuery(cqId, `Memilih: ${preset}`);
    return handleScraperCommand(chatId, preset, 20);
  }

  await answerCallbackQuery(cqId, "Memproses...");
}

/**
 * Handle incoming Telegram Messages
 */
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const fromUser = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  // 1. DETEKSI SHARE LOCATION (GPS PIN DARI HP)
  if (msg.location) {
    const lat = msg.location.latitude;
    const lon = msg.location.longitude;
    return handleLocationShare(chatId, lat, lon);
  }

  const text = msg.text ? msg.text.trim() : "";
  console.log(`📩 Pesan dari ${fromUser}: "${text}"`);

  // 2. COMMAND: /start & /help
  if (text === "/start" || text === "/help" || text === "menu") {
    const menu = `
🤖 <b>URBAN TECH SPATIAL & LEGAL COPILOT v5.0</b>
Halo <b>${fromUser}</b>!

Pilih fitur di menu bawah:
• 🛰️ <b>Download Citra & DEM (.TIF)</b> — Download GeoTIFF Satelit, DEM & Sensor
• 📊 <b>Analisis Spasial & Bencana</b> — Kelerengan, Drainase, InaRISK & Suhu LST
• 📐 <b>Laporan IMB & Kavling</b> — Terbitkan berkas resmi IMB/PBG + CAD (.DXF)
• 📍 <b>Scrape Google Maps</b> — Ekstrak database kontak & koordinat
• 📡 <b>Radar Bisnis Sekitar</b> — Kirim Share Location GPS untuk memindai area
• 📸 <b>Screenshot PC & Peta</b> — Pantau layar laptop live
`;
    return sendMessage(chatId, menu, getMainKeyboard());
  }

  // 3. ANALISIS SPASIAL & KEBENCANAAN
  if (
    text === "📊 Analisis Spasial & Bencana" ||
    text.startsWith("/analisis") ||
    text.startsWith("/kelerengan") ||
    text.startsWith("/slope") ||
    text.startsWith("/drainase") ||
    text.startsWith("/hydro") ||
    text.startsWith("/bencana") ||
    text.startsWith("/hazard") ||
    text.startsWith("/suhu") ||
    text.startsWith("/lst")
  ) {
    if (text.startsWith("/kelerengan ") || text.startsWith("/slope ")) {
      const q = text.replace("/kelerengan", "").replace("/slope", "").trim();
      return handleSpatialAnalysisExecution(chatId, "slope", q);
    }
    if (text.startsWith("/drainase ") || text.startsWith("/hydro ")) {
      const q = text.replace("/drainase", "").replace("/hydro", "").trim();
      return handleSpatialAnalysisExecution(chatId, "hydro", q);
    }
    if (text.startsWith("/bencana ") || text.startsWith("/hazard ")) {
      const q = text.replace("/bencana", "").replace("/hazard", "").trim();
      return handleSpatialAnalysisExecution(chatId, "hazard", q);
    }
    if (text.startsWith("/suhu ") || text.startsWith("/lst ")) {
      const q = text.replace("/suhu", "").replace("/lst", "").trim();
      return handleSpatialAnalysisExecution(chatId, "lst", q);
    }

    const reg = text
      .replace("/analisis", "")
      .replace("📊 Analisis Spasial & Bencana", "")
      .trim();

    return handleAnalysisMenu(chatId, reg);
  }

  // 3B. OPEN-SOURCE GLOBAL DATA & CLIMATE HUB
  if (
    text === "🌐 Data Global & Iklim (OpenSource)" ||
    text.startsWith("/opendata") ||
    text.startsWith("/global") ||
    text.startsWith("/worldpop") ||
    text.startsWith("/viirs") ||
    text.startsWith("/lampumalam") ||
    text.startsWith("/ghsl") ||
    text.startsWith("/dynamicworld") ||
    text.startsWith("/dw") ||
    text.startsWith("/esrilandcover") ||
    text.startsWith("/esri") ||
    text.startsWith("/hutan") ||
    text.startsWith("/canopy") ||
    text.startsWith("/gfw") ||
    text.startsWith("/polusi") ||
    text.startsWith("/s5p") ||
    text.startsWith("/tropomi") ||
    text.startsWith("/hujan") ||
    text.startsWith("/chirps") ||
    text.startsWith("/era5") ||
    text.startsWith("/solar") ||
    text.startsWith("/plts")
  ) {
    if (text.startsWith("/worldpop ")) {
      const q = text.replace("/worldpop", "").trim();
      return handleOpenDataExecution(chatId, "pop", q);
    }
    if (text.startsWith("/viirs ") || text.startsWith("/lampumalam ")) {
      const q = text.replace("/viirs", "").replace("/lampumalam", "").trim();
      return handleOpenDataExecution(chatId, "viirs", q);
    }
    if (text.startsWith("/ghsl ")) {
      const q = text.replace("/ghsl", "").trim();
      return handleOpenDataExecution(chatId, "ghsl", q);
    }
    if (text.startsWith("/dynamicworld ") || text.startsWith("/dw ")) {
      const q = text.replace("/dynamicworld", "").replace("/dw", "").trim();
      return handleOpenDataExecution(chatId, "dw", q);
    }
    if (text.startsWith("/esrilandcover ") || text.startsWith("/esri ")) {
      const q = text.replace("/esrilandcover", "").replace("/esri", "").trim();
      return handleOpenDataExecution(chatId, "esri", q);
    }
    if (text.startsWith("/hutan ") || text.startsWith("/canopy ") || text.startsWith("/gfw ")) {
      const q = text.replace("/hutan", "").replace("/canopy", "").replace("/gfw", "").trim();
      return handleOpenDataExecution(chatId, "forest", q);
    }
    if (text.startsWith("/polusi ") || text.startsWith("/s5p ") || text.startsWith("/tropomi ")) {
      const q = text.replace("/polusi", "").replace("/s5p", "").replace("/tropomi", "").trim();
      return handleOpenDataExecution(chatId, "s5p", q);
    }
    if (text.startsWith("/hujan ") || text.startsWith("/chirps ") || text.startsWith("/era5 ")) {
      const q = text.replace("/hujan", "").replace("/chirps", "").replace("/era5", "").trim();
      return handleOpenDataExecution(chatId, "rain", q);
    }
    if (text.startsWith("/solar ") || text.startsWith("/plts ")) {
      const q = text.replace("/solar", "").replace("/plts", "").trim();
      return handleOpenDataExecution(chatId, "solar", q);
    }

    const reg = text
      .replace("/opendata", "")
      .replace("/global", "")
      .replace("🌐 Data Global & Iklim (OpenSource)", "")
      .trim();

    return handleOpenDataMenu(chatId, reg);
  }

  // 4. SATELLITE & DEM GEOTIFF DOWNLOADER
  if (
    text === "🛰️ Download Citra & DEM (.TIF)" ||
    text.startsWith("/citra") ||
    text.startsWith("/satelit") ||
    text.startsWith("/dem") ||
    text.startsWith("/dsm") ||
    text.startsWith("/sentinel") ||
    text.startsWith("/landsat") ||
    text.startsWith("/alos") ||
    text.startsWith("/hillshade") ||
    text.startsWith("/ndvi") ||
    text.startsWith("/ndbi") ||
    text.toLowerCase().startsWith("download citra") ||
    text.toLowerCase().startsWith("download dem")
  ) {
    let customRegion = text
      .replace("/citra", "")
      .replace("/satelit", "")
      .replace("/dem", "")
      .replace("/dsm", "")
      .replace("/sentinel", "")
      .replace("/landsat", "")
      .replace("/alos", "")
      .replace("/hillshade", "")
      .replace("/ndvi", "")
      .replace("🛰️ Download Citra & DEM (.TIF)", "")
      .replace(/^download citra/i, "")
      .replace(/^download dem/i, "")
      .trim();

    if (customRegion) {
      return handleRasterResMenu(chatId, customRegion);
    }

    return handleRasterProvinceMenu(chatId);
  }

  // 4. RADAR BISNIS SEKITAR (GPS)
  if (text === "📡 Radar Bisnis Sekitar (GPS)") {
    return sendMessage(
      chatId,
      `📡 <b>RADAR INTELIJEN BISNIS SEKITAR:</b>\n\nSilakan klik tombol <b>Lampirkan (📎) $\rightarrow$ Kirim Lokasi (Share Location)</b> dari HP Anda.\n\nBot akan otomatis menganalisis semua bisnis, kafe, toko, dan kontak di radius sekitar Anda!`,
      getMainKeyboard()
    );
  }

  // 5. GENERATOR LAPORAN IMB & KAVLING
  if (
    text === "📐 Laporan IMB & Kavling" ||
    text.startsWith("/kavling") ||
    text.startsWith("/imb") ||
    text.toLowerCase().includes("laporan imb") ||
    text.toLowerCase().includes("kavling")
  ) {
    // Parsing parameter jika ada
    // Format: /kavling [nama] | [lokasi] | [panjang] | [lebar]
    let input = {
      nama: fromUser,
      lokasi: "Jl. Prof. Soedarto, Tembalang, Semarang",
      panjang: 20,
      lebar: 10,
    };

    if (text.includes("|")) {
      const parts = text.replace("/kavling", "").replace("/imb", "").split("|");
      if (parts[0]) input.nama = parts[0].trim();
      if (parts[1]) input.lokasi = parts[1].trim();
      if (parts[2]) input.panjang = parseFloat(parts[2].trim()) || 20;
      if (parts[3]) input.lebar = parseFloat(parts[3].trim()) || 10;
    } else {
      // Deteksi angka dimensi di teks (misal: "tanah 12x25" atau "15 x 20")
      const dimMatch = text.match(/(\d+)\s*[xX*]\s*(\d+)/);
      if (dimMatch) {
        input.panjang = parseFloat(dimMatch[1]);
        input.lebar = parseFloat(dimMatch[2]);
      }
    }

    return handleKavlingCommand(chatId, input);
  }

  // 5. SCRAPER WIZARD
  if (text === "📍 Scrape Google Maps") {
    const wizardText = `
📍 <b>PILIH KATEGORI SCRAPING GMAPS:</b>
Pilih tombol cepat di bawah atau ketik kustom:
`;
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "☕ Cafe Tembalang (20)", callback_data: "wiz_q:cafe di tembalang" },
          { text: "🏪 Indomaret Tembalang (20)", callback_data: "wiz_q:indomaret di tembalang" },
        ],
        [
          { text: "🏥 Apotek & RS Tegal (20)", callback_data: "wiz_q:apotek di tegal" },
          { text: "🏨 Hotel di Semarang (20)", callback_data: "wiz_q:hotel di semarang" },
        ],
      ],
    };
    return sendMessage(chatId, wizardText, inlineKeyboard);
  }

  // 6. SCRAPE QUERY
  if (
    text.startsWith("/scrape") ||
    text.startsWith("/gmaps") ||
    text.toLowerCase().startsWith("scrape ") ||
    text.toLowerCase().startsWith("tarik data ")
  ) {
    let rawQuery = text
      .replace("/scrape", "")
      .replace("/gmaps", "")
      .replace(/^scrape\s+/i, "")
      .replace(/^tarik data\s+/i, "")
      .trim();

    let query = rawQuery || "cafe di tembalang";
    let limit = 20;

    if (rawQuery.includes("|")) {
      const parts = rawQuery.split("|");
      query = parts[0].trim();
      const parsedLimit = parseInt(parts[1].trim(), 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) limit = parsedLimit;
    }

    return handleScraperCommand(chatId, query, limit);
  }

  // 7. SALES REPORT
  if (
    text === "📊 Laporan Sales & Omset" ||
    text === "/sales" ||
    text.toLowerCase().includes("omset")
  ) {
    const report = getSaaSReport();
    return sendMessage(chatId, report, getMainKeyboard());
  }

  // 8. SCREENSHOT PC
  if (
    text === "📸 Screenshot PC & Peta" ||
    text === "/screen" ||
    text.toLowerCase().includes("screenshot")
  ) {
    await sendMessage(chatId, "📸 <i>Mengambil tangkapan layar live PC...</i>");
    try {
      const buffer = await captureScreenshot();
      return sendPhoto(
        chatId,
        buffer,
        `🖥️ <b>Live Screenshot PC (${new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB)</b>`
      );
    } catch (err) {
      return sendMessage(chatId, `❌ Gagal mengambil screenshot: ${err.message}`, getMainKeyboard());
    }
  }

  // 9. CEK LAYER QGIS
  if (
    text === "🗺️ Cek Layer QGIS" ||
    text.toLowerCase().includes("layer") ||
    text.startsWith("/qgis")
  ) {
    await sendMessage(chatId, "🗺️ <i>Memeriksa status layer di QGIS Desktop...</i>");
    const script = `
layers = [l.name() for l in QgsProject.instance().mapLayers().values()]
if layers:
    print(f"Total {len(layers)} Layer Terbuka di QGIS:\\n" + "\\n".join([f"  • {name}" for name in layers]))
else:
    print("Saat ini belum ada layer yang dimuat di QGIS.")
`;
    const result = await sendToQgis(script);
    return sendMessage(chatId, `🗺️ <b>Hasil QGIS Desktop:</b>\n<pre>${result}</pre>`, getMainKeyboard());
  }

  // DEFAULT
  return handleScraperCommand(chatId, text, 20);
}

/**
 * Long Polling loop for Telegram Updates
 */
async function startPolling() {
  console.log("🚀 Telegram Bot Agent Bridge v5.0 (GPS Radar & IMB/PBG Legal Report) aktif!");

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

startPolling();
