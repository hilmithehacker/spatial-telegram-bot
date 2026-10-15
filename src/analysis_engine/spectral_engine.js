/**
 * @file spectral_engine.js
 * @description Strict Remote Sensing Spectral Index Engine.
 * Formulates mathematically correct band mathematics. NO RGB BRIGHTNESS SUBSTITUTIONS PERMITTED.
 */

class SpectralEngine {
  /**
   * Computes Normalized Difference Vegetation Index (NDVI)
   * Formula: (NIR - RED) / (NIR + RED)
   * @param {Float32Array} nirBand Array of Near-Infrared surface reflectance values (0.0 - 1.0)
   * @param {Float32Array} redBand Array of Red surface reflectance values (0.0 - 1.0)
   */
  static computeNDVI(nirBand, redBand, width, height) {
    if (!nirBand || !redBand || nirBand.length !== redBand.length) {
      throw new Error("ANALYSIS_BLOCKED: Komputasi NDVI mewajibkan pita fisik NIR dan Red dengan dimensi array identik.");
    }

    const size = width * height;
    const ndviGrid = new Float32Array(size);
    let validCount = 0;
    let sumNdvi = 0;
    let minNdvi = Infinity;
    let maxNdvi = -Infinity;

    for (let i = 0; i < size; i++) {
      const nir = nirBand[i];
      const red = redBand[i];

      // Handle NoData or division by zero
      const denominator = nir + red;
      if (isNaN(nir) || isNaN(red) || denominator <= 0.0001) {
        ndviGrid[i] = -9999.0; // Standard NoData value
        continue;
      }

      const val = (nir - red) / denominator;
      // Clamp to physical theoretical range [-1.0, 1.0]
      const clamped = Math.max(-1.0, Math.min(1.0, val));
      ndviGrid[i] = clamped;

      validCount++;
      sumNdvi += clamped;
      if (clamped < minNdvi) minNdvi = clamped;
      if (clamped > maxNdvi) maxNdvi = clamped;
    }

    const meanNdvi = validCount > 0 ? sumNdvi / validCount : 0;

    return {
      index: "NDVI",
      formula: "(NIR - RED) / (NIR + RED)",
      grid: ndviGrid,
      stats: {
        validPixels: validCount,
        noDataPixels: size - validCount,
        mean: parseFloat(meanNdvi.toFixed(4)),
        min: parseFloat(minNdvi.toFixed(4)),
        max: parseFloat(maxNdvi.toFixed(4)),
      },
    };
  }

  /**
   * Computes Normalized Difference Built-up Index (NDBI)
   * Formula: (SWIR1 - NIR) / (SWIR1 + NIR)
   */
  static computeNDBI(swir1Band, nirBand, width, height) {
    if (!swir1Band || !nirBand || swir1Band.length !== nirBand.length) {
      throw new Error("ANALYSIS_BLOCKED: Komputasi NDBI mewajibkan pita fisik SWIR-1 dan NIR. Citra visual RGB ditolak.");
    }

    const size = width * height;
    const ndbiGrid = new Float32Array(size);
    let validCount = 0;
    let sumNdbi = 0;
    let minNdbi = Infinity;
    let maxNdbi = -Infinity;

    for (let i = 0; i < size; i++) {
      const swir = swir1Band[i];
      const nir = nirBand[i];

      const denominator = swir + nir;
      if (isNaN(swir) || isNaN(nir) || denominator <= 0.0001) {
        ndbiGrid[i] = -9999.0;
        continue;
      }

      const val = (swir - nir) / denominator;
      const clamped = Math.max(-1.0, Math.min(1.0, val));
      ndbiGrid[i] = clamped;

      validCount++;
      sumNdbi += clamped;
      if (clamped < minNdbi) minNdbi = clamped;
      if (clamped > maxNdbi) maxNdbi = clamped;
    }

    return {
      index: "NDBI",
      formula: "(SWIR1 - NIR) / (SWIR1 + NIR)",
      grid: ndbiGrid,
      stats: {
        validPixels: validCount,
        mean: parseFloat((validCount > 0 ? sumNdbi / validCount : 0).toFixed(4)),
        min: parseFloat(minNdbi.toFixed(4)),
        max: parseFloat(maxNdbi.toFixed(4)),
      },
    };
  }
}

module.exports = {
  SpectralEngine,
};
