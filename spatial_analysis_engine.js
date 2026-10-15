/**
 * @file spatial_analysis_engine.js
 * @description Scientific Spatial Modeling & Terrain Morphology Engine.
 * PURGED: All pseudo-DEM, artificial sin-cos streams, and fabricated thermal formulas.
 */

const fs = require("fs");
const path = require("path");
const { TerrainEngine } = require("./src/analysis_engine/terrain_engine");
const { Classifier } = require("./src/classification_engine/classifier");
const { AcquisitionManager } = require("./src/data_acquisition/acquisition_manager");
const { ReportGenerator } = require("./src/reporting_engine/report_generator");
const { Preprocessor } = require("./src/preprocessing/preprocessor");
const { ProvenanceTracker } = require("./src/provenance_engine/provenance_tracker");
const { SCIENTIFIC_REFERENCES } = require("./src/reference_engine/reference_registry");
const { DATASET_CATALOG } = require("./src/data_catalog/catalog_registry");

/**
 * 1. Analisis Kelerengan Berstandar Permen PU No. 20/PRT/M/2007
 */
async function generateSlopeAnalysis(regionName, bbox, resOpt = "hd") {
  const exportDir = path.join(__dirname, "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const utm = Preprocessor.getIndonesianUtmZone(
    bbox.centerLon || (bbox.minLon + bbox.maxLon) / 2,
    bbox.centerLat || (bbox.minLat + bbox.maxLat) / 2
  );

  const provenance = ProvenanceTracker.createRecord({
    toolId: "slope",
    toolName: "Analisis Kelerengan (Permen PU 5 Kelas)",
    datasetId: "copernicus_dem_30",
    datasetCatalogMeta: DATASET_CATALOG.copernicus_dem_30,
    aoiQuery: regionName,
    bbox,
    utmZone: utm,
  });

  // Probe DEM Riil
  const demDiscovery = await AcquisitionManager.discoverCopernicusDEM(bbox);

  if (demDiscovery.status !== "SUCCESS") {
    return {
      status: "ANALYSIS_BLOCKED",
      code: "DEM_UNAVAILABLE",
      message: ReportGenerator.generateBlockedReport({
        toolName: "Analisis Kelerengan (Permen PU)",
        reason: "Layanan DEM fisik resmi (Copernicus DEM GLO-30 / DEMNAS) tidak dapat diakses untuk koordinat ini. Sistem menolak menghitung kemiringan lereng dari citra visual RGB.",
        requiredInputs: ["Digital Elevation Model (DEM) Fisik Riil Terproyeksi"],
        availableInputs: ["Citra Optik Visual Basemap Saja"],
      }),
      provenance,
    };
  }

  // Jika DEM berhasil diakses, lanjutkan proses Horn slope
  return {
    status: "ANALYSIS_BLOCKED",
    code: "DEM_COG_DOWNLOAD_PENDING",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Analisis Kelerengan (Permen PU)",
      reason: "Penyedia COG DEM memerlukan token autentikasi Copernicus CDSE. Ketiadaan data tidak digantikan dengan data sintetis.",
      requiredInputs: ["Copernicus DEM GLO-30 GeoTIFF"],
      availableInputs: [],
    }),
    provenance,
  };
}

/**
 * 2. Drainase & Hidrologi (D8 Hydrology)
 */
async function generateHydrologyDrainage(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "DEM_UNAVAILABLE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Arah Aliran Air & Drainase (D8 Hydrology)",
      reason: "Ekstraksi jaringan sungai memerlukan DEM fisik bebas depresi (depressionless DEM). Penggunaan formula sinus-cosinus buatan telah dilarang sepenuhnya oleh audit ilmiah.",
      requiredInputs: ["DEM Fisik Riil (DEMNAS / Copernicus DEM)", "Flow Direction Matrix", "Flow Accumulation Matrix"],
      availableInputs: [],
    }),
  };
}

/**
 * 3. Multi-Hazard Bencana (InaRISK Framework)
 */
async function generateMultiHazardAnalysis(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "INARISK_WMS_OFFLINE",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Multi-Hazard InaRISK & USGS",
      reason: "Koneksi WMS MapServer resmi InaRISK BNPB tidak merespons. Sesuai standar integritas data, sistem TIDAK membuat estimasi bahaya bencana fiktif dari foto satelit.",
      requiredInputs: ["Layer Indeks Bahaya Resmi BNPB (Banjir, Longsor, Gempa)"],
      availableInputs: [],
    }),
  };
}

/**
 * 4. Suhu Permukaan Lahan (LST)
 */
async function generateLstThermalAnalysis(regionName, bbox, resOpt = "hd") {
  return {
    status: "ANALYSIS_BLOCKED",
    code: "THERMAL_BAND_MISSING",
    message: ReportGenerator.generateBlockedReport({
      toolName: "Suhu Permukaan Lahan & Heat Island (LST)",
      reason: "Analisis LST mewajibkan data Termal Inframerah (TIR) fisik terkalibrasi radiometrik (Landsat TIRS Band 10 / MODIS). Menghitung suhu dari kecerahan foto optik siang hari adalah pelanggaran metodologis fatal.",
      requiredInputs: ["Thermal Infrared Sensor (TIRS / MODIS LST Level-2)"],
      availableInputs: ["Data Optik Visual Tanpa Saluran Termal"],
    }),
  };
}

module.exports = {
  generateSlopeAnalysis,
  generateHydrologyDrainage,
  generateMultiHazardAnalysis,
  generateLstThermalAnalysis,
};
