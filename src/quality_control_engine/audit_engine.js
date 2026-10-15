/**
 * @file audit_engine.js
 * @description Automated Scientific Audit Engine & Runtime Safety Guard.
 * Scans codebase and runtime executions for pseudo-data, Math.random(), and illicit RGB manipulations.
 */

const fs = require("fs");
const path = require("path");

const SCIENTIFIC_STRICT_MODE = true;

class AuditEngine {
  /**
   * Scans a target script file for anti-patterns and illicit pseudo-data generators
   */
  static auditSourceFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return { status: "ERROR", message: `Berkas ${filePath} tidak ditemukan.` };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    // Strip block comments and line comments so we inspect actual code logic
    const codeOnly = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
    const issues = [];

    // 1. Check for Math.random() in production analysis code
    const randomMatches = codeOnly.match(/Math\.random\s*\(\)/g);
    if (randomMatches) {
      issues.push({
        severity: "CRITICAL",
        type: "PSEUDO_RANDOM_DETECTION",
        count: randomMatches.length,
        description: "Ditemukan penggunaan Math.random() dalam kode eksekusi yang menghasilkan data ilmiah fiktif.",
      });
    }

    // 2. Check for brightness-to-elevation or brightness-to-spectral hacks
    if (codeOnly.includes("brightness * 0.95") || codeOnly.includes("latRatio * 320")) {
      issues.push({
        severity: "CRITICAL",
        type: "RGB_BRIGHTNESS_ELEVATION_FABRICATION",
        description: "Ditemukan sintesis elevasi topografi dari kecerahan citra optik basemap RGB.",
      });
    }

    // 3. Check for fake greenness / redness formulas pretending to be NDVI / NDBI
    if (codeOnly.includes("(g - r) / Math.max(1, g + r)") && codeOnly.includes("ndviGrid")) {
      issues.push({
        severity: "CRITICAL",
        type: "FAKE_NDVI_FORMULA",
        description: "Ditemukan kalkulasi NDVI menggunakan visual green-red tanpa pita NIR (Near-Infrared).",
      });
    }

    // 4. Check for fake POI generator
    if (codeOnly.includes("placeNum * 5") && codeOnly.includes("0812-")) {
      issues.push({
        severity: "CRITICAL",
        type: "SYNTHETIC_POI_HALLUCINATION",
        description: "Ditemukan generator tempat fiktif dan nomor telepon palsu pada modul scraper.",
      });
    }

    return {
      filePath: path.basename(filePath),
      auditDate: new Date().toISOString(),
      issuesFound: issues.length,
      strictModeActive: SCIENTIFIC_STRICT_MODE,
      passed: issues.length === 0,
      issues,
    };
  }

  /**
   * Runtime guard to enforce strict scientific mode
   */
  static assertScientificStrictMode(analysisName, hasAuthenticData) {
    if (SCIENTIFIC_STRICT_MODE && !hasAuthenticData) {
      throw new Error(`[SCIENTIFIC_STRICT_MODE] Eksekusi ${analysisName} DIBLOKIR. Data observasi/sensor riil tidak terpenuhi.`);
    }
  }
}

module.exports = {
  SCIENTIFIC_STRICT_MODE,
  AuditEngine,
};
