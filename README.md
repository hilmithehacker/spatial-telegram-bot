<div align="center">

# 🛰️ Spatial Intelligence & Satellite AI Bot
### *Autonomous Telegram Cloud Bot for Satellite Image Acquisition & Geoprocessing*

<p align="center">
  <img src="https://img.shields.io/badge/NODE.JS-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TELEGRAM_BOT_API-v6.0+-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" />
  <img src="https://img.shields.io/badge/COPERNICUS_DEM-GLO--30-002D62?style=for-the-badge&logo=nasa&logoColor=white" />
  <img src="https://img.shields.io/badge/SENTINEL--2-MSI_COG-0055A5?style=for-the-badge&logo=planetscale&logoColor=white" />
  <img src="https://img.shields.io/badge/PERMEN_PU_20%2F2007-COMPLIANT-green?style=for-the-badge" />
</p>

<p align="center">
  <b>An autonomous Telegram bot engine that turns complex remote sensing queries into instantaneous cartographic map layouts and calibrated GeoTIFF deliveries directly from your smartphone chat.</b>
</p>

---

</div>

## 🌟 Capabilities & Workflow

```
+-----------------------------------------------------------------------------------------+
|                               SPATIAL BOT CLOUD PIPELINE                                |
+-----------------------------------------------------------------------------------------+
|  1. USER QUERY (Telegram Chat)                                                          |
|     e.g., "Analisis kelerengan dan citra Sentinel-2 Kabupaten Tegal"                   |
+-----------------------------------------------------------------------------------------+
                                           ▲
                                           │ STAC API Discovery
                                           ▼
+-----------------------------------------------------------------------------------------+
|  2. CLOUD STAC ACQUISITION ENGINE                                                       |
|     • Planetary Computer STAC / Copernicus CDSE                                        |
|     • Copernicus GLO-30 DEM (30m) & Sentinel-2 L2A BOA Multispectral                    |
|     • Auto-selection of zero-cloud tiles                                               |
+-----------------------------------------------------------------------------------------+
                                           ▲
                                           │ Matrix DSP & Morphometry
                                           ▼
+-----------------------------------------------------------------------------------------+
|  3. SCIENTIFIC GEOPROCESSING CORE                                                       |
|     • Horn (1981) Slope Matrix & Permen PU No. 20/PRT/M/2007 5-Class Reclassification   |
|     • Spectral Indices: NDVI (Vegetation), MNDWI (Water/Flood), NDBI (Urban Density)    |
|     • D8 Hydrology Stream Extraction (O'Callaghan & Mark, 1984)                         |
+-----------------------------------------------------------------------------------------+
                                           ▲
                                           │ Canvas & PDF Generation
                                           ▼
+-----------------------------------------------------------------------------------------+
|  4. TELEGRAM DISPATCH                                                                   |
|     • Delivers 300 DPI Academic Layout PNG/PDF + Raw GeoTIFF + Statistics Summary       |
+-----------------------------------------------------------------------------------------+
```

---

## 🚀 Bot Commands & Capabilities

| Command / Trigger | Pipeline Description | Deliverable Output |
|---|---|---|
| **`/slope <wilayah>`** | Copernicus GLO-30 DEM Horn slope reclassified into 5 statutory classes (0-8%, 8-15%, 15-25%, 25-40%, >40%) | Thematic Map Layout + Area Balance (Ha & %) |
| **`/sentinel2 <wilayah>`** | True-color (RGB B4-B3-B2) or False-color (NIR B8-B4-B3) cloud-free composite | High-Res Orthoimage Preview + GeoTIFF |
| **`/indices <wilayah>`** | Multispectral Band Math: NDVI, MNDWI, and NDBI extraction | Spectral Index Map + Histogram |
| **`/hydro <wilayah>`** | Depressionless DEM extraction, flow accumulation & drainage network | D8 River Basin Vectors + Flow Map |
| **`/lst <wilayah>`** | Land Surface Temperature from radiometrically calibrated thermal infrared bands | Thermal Heat Island (UHI) Surface Map |

---

## 🛡️ Scientific Rigor (Zero-Hallucination Policy)

This bot operates under strict geospatial data integrity rules:
- **No RGB Elevation Synthesis**: Terrain slope and hydrology strictly require true physical elevation models (Copernicus DEM or DEMNAS), explicitly rejecting synthetic elevation estimation from RGB basemaps.
- **Projected Coordinate Discipline**: All distance and area metrics are reprojected into national UTM Zones (e.g. EPSG:32749 for Central Java) before calculation.

---

## 🛠️ Quick Start & Self-Hosting

### Prerequisites
- **Node.js** >= 18.0.0
- Telegram Bot Token (from `@BotFather`)

### 1. Installation
```bash
git clone https://github.com/hilmithehacker/spatial-telegram-bot.git
cd spatial-telegram-bot
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
AUTHORIZED_CHAT_ID=your_chat_id_here
```

### 3. Launch Bot
```bash
npm start
# atau jalankan modul spatial khusus:
npm run spatial
```

---

## 📂 Repository Layout

```
spatial-telegram-bot/
├── bot.js                          # Main Telegram bot polling & command router
├── spatial_bot.js                  # Spatial intelligence bot handler
├── spatial_analysis_engine.js      # Scientific geoprocessing orchestrator
├── raster_engine.js                # Remote sensing acquisition engine
├── cartographic_layout_engine.js   # Automated map layout generator
├── geoportal_engine.js             # National geoportal integration (BIG, InaRISK)
│
├── src/                            # Modular Analytics Engines
│   ├── analysis_engine/            # Terrain & Horn slope morphometry
│   ├── classification_engine/      # Permen PU 5-class reclassification
│   ├── data_acquisition/           # Planetary Computer STAC search
│   ├── data_catalog/               # Copernicus & DEMNAS metadata registry
│   └── reference_engine/           # Scientific citations and standard benchmarks
│
├── tests/                          # Automated regression & scientific audit tests
└── package.json                    # Project dependencies
```

---

<div align="center">
  <b>Developed by <a href="https://github.com/hilmithehacker">@hilmithehacker</a></b><br/>
  <i>Autonomous Cloud-Native Geospatial Systems.</i>
</div>
