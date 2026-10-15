/**
 * @file uncertainty_estimator.js
 * @description Spatial Uncertainty, Precision & Margin of Error Engine.
 * Restricts unwarranted decimal precision and states analytical bounds explicitly.
 */

class UncertaintyEstimator {
  /**
   * Formats numbers to realistic significant figures based on spatial resolution
   */
  static formatSignificantValue(val, resolutionMeters) {
    if (typeof val !== "number" || isNaN(val)) return "N/A";

    // Macro-resolution data (1km - 5km) cannot claim 4 decimal precision
    if (resolutionMeters >= 1000) {
      return val.toFixed(1);
    } else if (resolutionMeters >= 30) {
      return val.toFixed(2);
    } else {
      return val.toFixed(2);
    }
  }

  /**
   * Generates uncertainty statement for remote sensing products
   */
  static getUncertaintyProfile(sensorType, cloudCover = 0) {
    const profiles = {
      optical_multispectral: {
        spatialUncertainty: "Akurasi posisi horisontal Sentinel-2: < 5 meter CE95 (ESA Cal/Val).",
        radiometricUncertainty: "Reflektansi permukaan Level-2A memiliki ketidakpastian tipikal ±3-5% akibat estimasi AOT atmosfer.",
        cloudEffect: cloudCover > 0 ? `Toleransi tutupan awan: ${cloudCover.toFixed(1)}%. Piksel di dekat awan tipis mungkin mengalami hamburan Rayleigh.` : "Bebas awan.",
      },
      dem_elevation: {
        verticalUncertainty: "Copernicus DEM GLO-30 memiliki akurasi vertikal absolut LE90 < 4 meter pada medan non-pegunungan ekstrem.",
        slopeUncertainty: "Kelerengan turunan memiliki deviasi tipikal ±1.5° dibandingkan survei LiDAR/RTK GNSS terestrial.",
      },
      climate_reanalysis: {
        precipitationUncertainty: "Data grid CHIRPS memiliki korelasi r = 0.75-0.88 terhadap stasiun BMKG, dengan deviasi standar musiman ±15-20%.",
      },
    };

    return profiles[sensorType] || {
      generalUncertainty: "Hasil estimasi berbasis pemodelan raster. Presisi terbatas pada resolusi grid sel.",
    };
  }
}

module.exports = {
  UncertaintyEstimator,
};
