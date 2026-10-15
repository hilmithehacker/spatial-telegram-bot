/**
 * @file validation_manager.js
 * @description Scientific Validation & Accuracy Management Engine.
 * Enforces explicit validation tags and prevents unsubstantiated claims.
 */

const VALIDATION_STATUSES = {
  VALIDATED: "VALIDATED",                     // Ground truth or calibrated reference verified
  PARTIALLY_VALIDATED: "PARTIALLY_VALIDATED", // Cross-referenced with authoritative secondary dataset
  NOT_VALIDATED: "NOT_VALIDATED",             // Valid observation model without local ground truth
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",       // Official upstream service offline or empty
  ANALYSIS_BLOCKED: "ANALYSIS_BLOCKED",       // Required physical bands / inputs absent
};

class ValidationManager {
  /**
   * Evaluates analysis validity and attaches validation status
   */
  static evaluateAnalysis({ toolId, hasAuthenticInput, inputProvider, groundTruthAvailable = false }) {
    if (!hasAuthenticInput) {
      return {
        status: VALIDATION_STATUSES.ANALYSIS_BLOCKED,
        isActionable: false,
        summary: "Analisis diblokir secara otomatis karena ketiadaan data masukan autentik.",
      };
    }

    if (groundTruthAvailable) {
      return {
        status: VALIDATION_STATUSES.VALIDATED,
        isActionable: true,
        summary: "Data telah divalidasi terhadap titik kontrol lapangan / stasiun in-situ resmi.",
      };
    }

    if (["sentinel2_l2a", "demnas_big", "copernicus_dem_30"].includes(inputProvider)) {
      return {
        status: VALIDATION_STATUSES.PARTIALLY_VALIDATED,
        isActionable: true,
        summary: "Data bersumber dari sensor terkalibrasi operasional (Level-2A BOA / DEMNAS). Hasil bersifat indikatif makro terverifikasi.",
      };
    }

    return {
      status: VALIDATION_STATUSES.NOT_VALIDATED,
      isActionable: true,
      summary: "Hasil analisis bersifat model spasial estimasi tanpa kalibrasi sampel lapangan lokal.",
    };
  }
}

module.exports = {
  VALIDATION_STATUSES,
  ValidationManager,
};
