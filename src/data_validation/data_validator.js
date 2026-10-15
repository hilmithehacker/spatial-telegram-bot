/**
 * @file data_validator.js
 * @description Quality Gate & Spatial Pre-Flight Data Validation Engine.
 * Enforces strict scientific readiness before any analytical processing begins.
 */

class DataValidator {
  /**
   * Validates Bounding Box geometry and geographic bounds
   */
  static validateBBox(bbox) {
    if (!bbox || typeof bbox !== "object") {
      return { valid: false, code: "INVALID_BBOX", reason: "Bounding box tidak terdefinisi atau format null." };
    }

    const { minLon, minLat, maxLon, maxLat } = bbox;

    if (
      typeof minLon !== "number" ||
      typeof minLat !== "number" ||
      typeof maxLon !== "number" ||
      typeof maxLat !== "number" ||
      isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat)
    ) {
      return { valid: false, code: "NAN_COORDINATES", reason: "Nilai koordinat batas memuat NaN atau non-numerik." };
    }

    if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) {
      return { valid: false, code: "OUT_OF_WGS84_RANGE", reason: "Koordinat melampaui batas geografis global WGS84 (-180..180, -90..90)." };
    }

    if (minLon >= maxLon || minLat >= maxLat) {
      return { valid: false, code: "INVERTED_COORDINATES", reason: "Koordinat minimum bernilai lebih besar atau sama dengan koordinat maksimum." };
    }

    // Check Indonesia geographic span: ~95°E to 141°E, ~6°N to 11°S
    const inIndonesia = minLon >= 94.0 && maxLon <= 142.0 && minLat >= -12.0 && maxLat <= 7.0;

    return {
      valid: true,
      inIndonesia,
      lonSpanDeg: maxLon - minLon,
      latSpanDeg: maxLat - minLat,
    };
  }

  /**
   * Validates dataset requirements against available input bands
   */
  static validateSpectralRequirements(requiredMethod, availableBands = []) {
    const REQUIREMENTS = {
      NDVI: ["RED", "NIR"],
      NDBI: ["SWIR1", "NIR"],
      MNDWI: ["GREEN", "SWIR1"],
      LST: ["TIR_SURFACE_TEMPERATURE"],
      SLOPE: ["TRUE_DEM_ELEVATION"],
      HYDROLOGY: ["TRUE_DEM_ELEVATION"],
    };

    const needed = REQUIREMENTS[requiredMethod];
    if (!needed) {
      return { valid: true };
    }

    const missing = needed.filter((b) => !availableBands.includes(b));
    if (missing.length > 0) {
      return {
        valid: false,
        code: "SPECTRAL_BANDS_MISSING",
        reason: `Metode ${requiredMethod} memerlukan pita spektral fisik [${needed.join(", ")}]. Pita yang tidak tersedia: [${missing.join(", ")}].`,
        neededBands: needed,
        missingBands: missing,
      };
    }

    return { valid: true };
  }

  /**
   * Validates cloud cover threshold
   */
  static validateCloudCover(sceneCloudCoverPercent, maxAllowed = 20) {
    if (typeof sceneCloudCoverPercent === "number" && sceneCloudCoverPercent > maxAllowed) {
      return {
        valid: false,
        code: "EXCESSIVE_CLOUD_COVER",
        reason: `Tutupan awan scene (${sceneCloudCoverPercent.toFixed(1)}%) melampaui batas toleransi ilmiah (${maxAllowed}%). Data optik tidak layak untuk analisis spektral.`,
      };
    }
    return { valid: true };
  }

  /**
   * Validates NoData ratios
   */
  static validateNoDataRatio(validPixelCount, totalPixelCount, maxNoDataRatio = 0.4) {
    const noDataRatio = 1 - (validPixelCount / totalPixelCount);
    if (noDataRatio > maxNoDataRatio) {
      return {
        valid: false,
        code: "EXCESSIVE_NODATA",
        reason: `Rasio sel NoData/Missing (${(noDataRatio * 100).toFixed(1)}%) melampaui ambang batas ${maxNoDataRatio * 100}%.`,
      };
    }
    return { valid: true, noDataRatio };
  }
}

module.exports = {
  DataValidator,
};
