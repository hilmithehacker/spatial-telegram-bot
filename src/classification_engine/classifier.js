/**
 * @file classifier.js
 * @description Methodologically Defensible Geospatial Classification Engine.
 * Implements legal Indonesian spatial planning standards (Permen PU) and statistical classification.
 */

class Classifier {
  /**
   * Classifies slope according to Peraturan Menteri Pekerjaan Umum No. 20/PRT/M/2007
   */
  static classifySlopePermenPU(slopePct) {
    if (slopePct < 0 || slopePct > 500 || isNaN(slopePct) || slopePct <= -9000) {
      return { classId: 0, className: "NoData / Diluar Batas", colorHex: "#00000000", code: "NODATA" };
    }

    if (slopePct < 8.0) {
      return { classId: 1, className: "Datar (0 - 8 %)", colorHex: "#1a9641", code: "SLOPE_FLAT" };
    } else if (slopePct < 15.0) {
      return { classId: 2, className: "Landai (8 - 15 %)", colorHex: "#a6d96a", code: "SLOPE_GENTLE" };
    } else if (slopePct < 25.0) {
      return { classId: 3, className: "Agak Curam (15 - 25 %)", colorHex: "#ffffbf", code: "SLOPE_MODERATE" };
    } else if (slopePct < 45.0) {
      return { classId: 4, className: "Curam (25 - 45 %)", colorHex: "#fdae61", code: "SLOPE_STEEP" };
    } else {
      return { classId: 5, className: "Sangat Curam (> 45 %)", colorHex: "#d7191c", code: "SLOPE_VERY_STEEP" };
    }
  }

  /**
   * Classifies NDVI according to Deering (1978) and Rouse (1974)
   */
  static classifyNDVI(val) {
    if (isNaN(val) || val < -1.0 || val > 1.0 || val <= -9000) {
      return { classId: 0, className: "NoData", colorHex: "#00000000" };
    }

    if (val < 0.0) {
      return { classId: 1, className: "Badan Air / Non-Vegetasi (< 0.0)", colorHex: "#0077b6" };
    } else if (val < 0.2) {
      return { classId: 2, className: "Lahan Terbuka / Vegetasi Sangat Jarang (0.0 - 0.2)", colorHex: "#e9c46a" };
    } else if (val < 0.4) {
      return { classId: 3, className: "Kerapatan Rendah / Pertanian (0.2 - 0.4)", colorHex: "#a7c957" };
    } else if (val < 0.6) {
      return { classId: 4, className: "Kerapatan Sedang / Kebun (0.4 - 0.6)", colorHex: "#588157" };
    } else {
      return { classId: 5, className: "Kerapatan Tinggi / Kanopi Rapat (> 0.6)", colorHex: "#1b4332" };
    }
  }

  /**
   * Classifies NDBI according to Zha et al. (2003)
   */
  static classifyNDBI(val) {
    if (isNaN(val) || val <= -9000) {
      return { classId: 0, className: "NoData", colorHex: "#00000000" };
    }

    if (val < 0.0) {
      return { classId: 1, className: "Non-Terbangun / Badan Air (< 0.0)", colorHex: "#2b8a3e" };
    } else if (val < 0.1) {
      return { classId: 2, className: "Kepadatan Bangunan Rendah (0.0 - 0.1)", colorHex: "#fab005" };
    } else if (val < 0.25) {
      return { classId: 3, className: "Kepadatan Bangunan Sedang (0.1 - 0.25)", colorHex: "#f08c00" };
    } else {
      return { classId: 4, className: "Kawasan Urban Sangat Padat (> 0.25)", colorHex: "#e03131" };
    }
  }

  /**
   * Computes Zonal Area Statistics for Classified Roster in Hectares
   */
  static computeZonalStatistics(classGrid, classesDef, cellAreaM2) {
    const counts = {};
    let totalValid = 0;

    for (const c of classesDef) {
      counts[c.classId] = 0;
    }

    for (let i = 0; i < classGrid.length; i++) {
      const cid = classGrid[i];
      if (counts[cid] !== undefined) {
        counts[cid]++;
        totalValid++;
      }
    }

    const cellAreaHa = cellAreaM2 / 10000.0;
    return classesDef.map((c) => {
      const count = counts[c.classId] || 0;
      const areaHa = count * cellAreaHa;
      const pct = totalValid > 0 ? (count / totalValid) * 100.0 : 0;
      return {
        classId: c.classId,
        className: c.className,
        colorHex: c.colorHex,
        pixelCount: count,
        areaHa: parseFloat(areaHa.toFixed(2)),
        percentage: parseFloat(pct.toFixed(2)),
      };
    });
  }
}

module.exports = {
  Classifier,
};
