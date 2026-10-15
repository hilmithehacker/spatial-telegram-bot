/**
 * @file scientific_regression_test.js
 * @description Comprehensive Scientific Regression Test Suite.
 * Validates zero pseudo-data, rigorous quality gates, provenance tracking, and classification standards.
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const { AuditEngine, SCIENTIFIC_STRICT_MODE } = require("../src/quality_control_engine/audit_engine");
const { SpectralEngine } = require("../src/analysis_engine/spectral_engine");
const { TerrainEngine } = require("../src/analysis_engine/terrain_engine");
const { Classifier } = require("../src/classification_engine/classifier");
const { Preprocessor } = require("../src/preprocessing/preprocessor");
const { ProvenanceTracker } = require("../src/provenance_engine/provenance_tracker");
const { DataValidator } = require("../src/data_validation/data_validator");
const { DATASET_CATALOG } = require("../src/data_catalog/catalog_registry");
const { SCIENTIFIC_REFERENCES } = require("../src/reference_engine/reference_registry");

console.log("================================================================");
console.log("🔬 STARTING SCIENTIFIC GEOSPATIAL REGRESSION TEST SUITE");
console.log("================================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}: ${err.message}`);
  }
}

// ----------------------------------------------------------------------
// 1. STATIC CODE AUDIT: ZERO RANDOM & ZERO BRIGHTNESS ELEVATION HACKS
// ----------------------------------------------------------------------
runTest("TEST 1: No Math.random() in raster_engine.js", () => {
  const audit = AuditEngine.auditSourceFile(path.join(__dirname, "../raster_engine.js"));
  assert.strictEqual(audit.passed, true, "raster_engine.js memuat pola acak terlarang!");
});

runTest("TEST 2: No Math.random() in spatial_analysis_engine.js", () => {
  const audit = AuditEngine.auditSourceFile(path.join(__dirname, "../spatial_analysis_engine.js"));
  assert.strictEqual(audit.passed, true, "spatial_analysis_engine.js memuat pola acak terlarang!");
});

runTest("TEST 3: No Math.random() in opensource_data_engine.js", () => {
  const audit = AuditEngine.auditSourceFile(path.join(__dirname, "../opensource_data_engine.js"));
  assert.strictEqual(audit.passed, true, "opensource_data_engine.js memuat pola acak terlarang!");
});

runTest("TEST 4: No Fake 0812 phone generation in scraper.js", () => {
  const audit = AuditEngine.auditSourceFile(path.join(__dirname, "../scraper.js"));
  assert.strictEqual(audit.passed, true, "scraper.js memuat generator telepon palsu!");
});

// ----------------------------------------------------------------------
// 2. REMOTE SENSING FORMULA ACCURACY (STRICT BAND MATHEMATICS)
// ----------------------------------------------------------------------
runTest("TEST 5: Strict NDVI formula = (NIR - RED) / (NIR + RED)", () => {
  const nir = new Float32Array([0.8, 0.4, 0.1]);
  const red = new Float32Array([0.2, 0.2, 0.1]);
  const res = SpectralEngine.computeNDVI(nir, red, 3, 1);

  // Pixel 0: (0.8 - 0.2) / (0.8 + 0.2) = 0.60
  assert.strictEqual(parseFloat(res.grid[0].toFixed(2)), 0.60);
  // Pixel 1: (0.4 - 0.2) / (0.4 + 0.2) = 0.33
  assert.strictEqual(parseFloat(res.grid[1].toFixed(2)), 0.33);
  // Pixel 2: (0.1 - 0.1) / (0.1 + 0.1) = 0.00
  assert.strictEqual(parseFloat(res.grid[2].toFixed(2)), 0.00);
});

runTest("TEST 6: NDVI blocks execution when bands are mismatched or missing", () => {
  assert.throws(() => {
    SpectralEngine.computeNDVI(null, new Float32Array([0.1]), 1, 1);
  }, /ANALYSIS_BLOCKED/);
});

// ----------------------------------------------------------------------
// 3. TERRAIN MORPHOMETRY (HORN SLOPE ON TRUE PHYSICAL ELEVATION)
// ----------------------------------------------------------------------
runTest("TEST 7: Horn slope calculation on known planar gradient", () => {
  // 3x3 DEM grid with uniform 10m rise per 10m run along X axis (100% slope = 45 degrees)
  const elev = new Float32Array([
    0, 10, 20,
    0, 10, 20,
    0, 10, 20,
  ]);
  const res = TerrainEngine.computeSlope(elev, 3, 3, 10);
  // Center pixel (1, 1) slope should be exactly 100%
  const centerSlopePct = res.slopePctGrid[4];
  assert.strictEqual(Math.round(centerSlopePct), 100);
  const centerSlopeDeg = res.slopeDegGrid[4];
  assert.strictEqual(Math.round(centerSlopeDeg), 45);
});

// ----------------------------------------------------------------------
// 4. REGULATORY CLASSIFICATION (PERMEN PU NO. 20/PRT/M/2007)
// ----------------------------------------------------------------------
runTest("TEST 8: Slope classification strictly follows Permen PU 5 Classes", () => {
  assert.strictEqual(Classifier.classifySlopePermenPU(4.0).classId, 1);   // 0-8% Datar
  assert.strictEqual(Classifier.classifySlopePermenPU(12.0).classId, 2);  // 8-15% Landai
  assert.strictEqual(Classifier.classifySlopePermenPU(20.0).classId, 3);  // 15-25% Agak Curam
  assert.strictEqual(Classifier.classifySlopePermenPU(35.0).classId, 4);  // 25-45% Curam
  assert.strictEqual(Classifier.classifySlopePermenPU(55.0).classId, 5);  // >45% Sangat Curam
});

// ----------------------------------------------------------------------
// 5. INDONESIAN UTM ZONE CALCULATION (SRGI 2013)
// ----------------------------------------------------------------------
runTest("TEST 9: Correct UTM Zone for Semarang / Central Java (Zone 49S)", () => {
  const utmSemarang = Preprocessor.getIndonesianUtmZone(110.4381, -7.0051);
  assert.strictEqual(utmSemarang.zoneNumber, 49);
  assert.strictEqual(utmSemarang.hemisphere, "S");
  assert.strictEqual(utmSemarang.epsg, "EPSG:32749");
});

runTest("TEST 10: Correct UTM Zone for IKN Nusantara / East Kalimantan (Zone 50S)", () => {
  const utmIkn = Preprocessor.getIndonesianUtmZone(116.7, -0.9);
  assert.strictEqual(utmIkn.zoneNumber, 50);
  assert.strictEqual(utmIkn.hemisphere, "S");
  assert.strictEqual(utmIkn.epsg, "EPSG:32750");
});

// ----------------------------------------------------------------------
// 6. PROVENANCE & DATA INTEGRITY
// ----------------------------------------------------------------------
runTest("TEST 11: Provenance tracker produces valid immutable SHA-256 record", () => {
  const prov = ProvenanceTracker.createRecord({
    toolId: "sentinel2",
    toolName: "Sentinel-2 L2A",
    datasetId: "sentinel2_l2a",
    datasetCatalogMeta: DATASET_CATALOG.sentinel2_l2a,
    aoiQuery: "Kabupaten Tegal",
    bbox: { minLon: 109.1, minLat: -7.1, maxLon: 109.2, maxLat: -7.0 },
    utmZone: { name: "UTM 49S", epsg: "EPSG:32749" },
  });

  assert.ok(prov.analysis_id.startsWith("SYN-"));
  const finalized = ProvenanceTracker.finalizeRecord(prov, { status: "TEST_SUCCESS" });
  assert.strictEqual(finalized.reproducibility.hash.length, 64); // 64 hex characters SHA-256
});

// ----------------------------------------------------------------------
// 7. SCIENTIFIC STRICT MODE & QUALITY GATE BLOCKING
// ----------------------------------------------------------------------
runTest("TEST 12: DataValidator blocks missing physical bands", () => {
  const validation = DataValidator.validateSpectralRequirements("NDVI", ["RED"]); // NIR missing
  assert.strictEqual(validation.valid, false);
  assert.strictEqual(validation.code, "SPECTRAL_BANDS_MISSING");
});

console.log("\n================================================================");
console.log(`📊 TEST SUITE SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
if (passedTests === totalTests) {
  console.log("🎉 ALL SCIENTIFIC REGRESSION TESTS PASSED! CODEBASE IS RIGOROUS.");
} else {
  console.log("⚠️ SOME TESTS FAILED! INSPECT ERRORS ABOVE.");
  process.exit(1);
}
console.log("================================================================");
