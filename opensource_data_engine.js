/**
 * @file opensource_data_engine.js
 * @description Authentic Global Open Data & Environmental Observation Engine.
 * PURGED: All Math.random(), fake population calculations, and synthetic daytime nightlights.
 */

const { ReportGenerator } = require("./src/reporting_engine/report_generator");
const { DATASET_CATALOG } = require("./src/data_catalog/catalog_registry");

async function generateWorldPopDensity(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "WORLDPOP_API_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Kepadatan Penduduk (WorldPop 100m)",
      reason: "Server repositori WorldPop FTP/REST memerlukan unduhan grid unconstrained nasional penuh. Sistem menolak mengarang kepadatan penduduk dari kecerahan atap foto satelit.",
      requiredInputs: ["Raster Demografi WorldPop 100m Resmi"],
      availableInputs: [],
    }),
  };
}

async function generateViirsNightLights(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "VIIRS_DATA_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Lampu Malam Satelit (NASA/NOAA VIIRS DNB)",
      reason: "Produk VIIRS DNB Nighttime Lights bulanan/tahunan memerlukan autentikasi Earthdata NASA. Mengubah citra siang hari menjadi pancaran radiasi malam nW/cm²/sr adalah pelanggaran ilmiah.",
      requiredInputs: ["Citra Malam Sensor DNB Suomi-NPP / NOAA-20"],
      availableInputs: ["Citra Optik Siang Hari Saja"],
    }),
  };
}

async function generateGhslBuiltupEpoch(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "GHSL_DATA_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Kronologi Pertumbuhan Kota (GHSL Epoch)",
      reason: "Data historis GHS-BUILT-S R2023A (1975-2020) dari European Commission JRC tidak dapat disintesis dari foto satelit modern tunggal.",
      requiredInputs: ["Raster GHSL Multitemporal JRC Resmi"],
      availableInputs: [],
    }),
  };
}

async function generateForestCanopyCover(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "HANSEN_GFW_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Tutupan Kanopi Hutan (Global Forest Watch Hansen)",
      reason: "Produk Hansen TreeCover2000 & LossYear memerlukan pembacaan tile Cloud Optimized GeoTIFF dari repositori UMD/Google. Indeks hijau visual (G-R) ditolak sebagai estimasi kanopi hutan.",
      requiredInputs: ["Tile COG Hansen Global Forest Change v1.11"],
      availableInputs: [],
    }),
  };
}

async function generateSentinel5pAirQuality(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "SENTINEL5P_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Kualitas Udara & Polusi NO2 (Sentinel-5P TROPOMI)",
      reason: "Data densitas kolom vertikal troposfer NO2 (mol/m²) dari instrumen spektrometer TROPOMI memerlukan produk L2 NetCDF/COG resmi. Simulasi polusi dari kecerahan jalan raya dilarang.",
      requiredInputs: ["Sentinel-5P OFFL L2 NO2 Data"],
      availableInputs: [],
    }),
  };
}

async function generateChirpsRainfall(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "CHIRPS_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Curah Hujan Historis & Isohyet (CHIRPS v2.0)",
      reason: "Estimasi presipitasi bulanan/tahunan harus bersumber dari grid CHIRPS v2.0 atau reanalisis ERA5-Land. Menghitung curah hujan berdasarkan posisi koordinat garis lintang telah dihapus.",
      requiredInputs: ["Raster CHIRPS-2.0 Resmi (mm)"],
      availableInputs: [],
    }),
  };
}

async function generateGlobalSolarAtlas(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "SOLAR_ATLAS_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Potensi Energi Surya PLTS (Global Solar Atlas GHI)",
      reason: "Nilai radiasi horizontal global (GHI kWh/m²/hari) harus bersumber dari model Solargis / World Bank Global Solar Atlas, bukan rumus garis lintang linear buatan.",
      requiredInputs: ["GeoTIFF GHI Global Solar Atlas Resmi"],
      availableInputs: [],
    }),
  };
}

async function generateDynamicWorldLulc(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "DYNAMIC_WORLD_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Dynamic World 10m Near-Real-Time Land Cover",
      reason: "Inferensi tutupan lahan Deep Learning 9-kelas Dynamic World memerlukan koneksi API Google Earth Engine / STAC AWS terbuka.",
      requiredInputs: ["Dynamic World NRT Probability Raster"],
      availableInputs: [],
    }),
  };
}

async function generateEsriMultiYearLandCover(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "ESRI_LULC_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "ESRI 10m Multi-Year Land Cover",
      reason: "Klasifikasi tahunan 2017-2024 ESRI LULC memerlukan tile resmi Impact Observatory AWS Open Data.",
      requiredInputs: ["ESRI 10m Land Cover Annual GeoTIFF"],
      availableInputs: [],
    }),
  };
}

module.exports = {
  generateWorldPopDensity,
  generateViirsNightLights,
  generateGhslBuiltupEpoch,
  generateForestCanopyCover,
  generateSentinel5pAirQuality,
  generateChirpsRainfall,
  generateGlobalSolarAtlas,
  generateDynamicWorldLulc,
  generateEsriMultiYearLandCover,
};
