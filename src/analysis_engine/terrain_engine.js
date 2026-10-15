/**
 * @file terrain_engine.js
 * @description Strict Digital Elevation & Terrain Morphology Engine.
 * Calculates slope using Horn (1981) 3x3 algorithm on true DEM physical elevation matrices.
 * STRICT POLICY: Rejects synthetic RGB brightness elevation grids.
 */

class TerrainEngine {
  /**
   * Computes Horn (1981) slope in percent and degrees
   * @param {Float32Array} elevGrid Array of physical elevation values in meters
   * @param {number} width Grid width
   * @param {number} height Grid height
   * @param {number} cellResMeters Spatial resolution in meters (e.g. 30m for Copernicus DEM, 8.1m for DEMNAS)
   */
  static computeSlope(elevGrid, width, height, cellResMeters = 30) {
    if (!elevGrid || elevGrid.length !== width * height) {
      throw new Error("ANALYSIS_BLOCKED: Grid elevasi fisik tidak valid atau dimensi tidak cocok.");
    }

    if (cellResMeters <= 0) {
      throw new Error("ANALYSIS_BLOCKED: Resolusi sel planar (meter) harus bernilai positif.");
    }

    const size = width * height;
    const slopePctGrid = new Float32Array(size);
    const slopeDegGrid = new Float32Array(size);

    let validCount = 0;
    let sumSlope = 0;
    let minSlope = Infinity;
    let maxSlope = -Infinity;

    // 3x3 Sobel-Horn window filter
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        const z1 = elevGrid[(y - 1) * width + (x - 1)];
        const z2 = elevGrid[(y - 1) * width + x];
        const z3 = elevGrid[(y - 1) * width + (x + 1)];
        const z4 = elevGrid[y * width + (x - 1)];
        const z6 = elevGrid[y * width + (x + 1)];
        const z7 = elevGrid[(y + 1) * width + (x - 1)];
        const z8 = elevGrid[(y + 1) * width + x];
        const z9 = elevGrid[(y + 1) * width + (x + 1)];

        // Check NoData in 3x3 neighborhood
        if (
          z1 <= -9990 || z2 <= -9990 || z3 <= -9990 ||
          z4 <= -9990 || z6 <= -9990 ||
          z7 <= -9990 || z8 <= -9990 || z9 <= -9990
        ) {
          slopePctGrid[idx] = -9999.0;
          slopeDegGrid[idx] = -9999.0;
          continue;
        }

        // Horn formulation for partial derivatives
        const dz_dx = ((z3 + 2.0 * z6 + z9) - (z1 + 2.0 * z4 + z7)) / (8.0 * cellResMeters);
        const dz_dy = ((z7 + 2.0 * z8 + z9) - (z1 + 2.0 * z2 + z3)) / (8.0 * cellResMeters);

        const rise_run = Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy);
        const slopePct = rise_run * 100.0;
        const slopeDeg = Math.atan(rise_run) * (180.0 / Math.PI);

        slopePctGrid[idx] = slopePct;
        slopeDegGrid[idx] = slopeDeg;

        validCount++;
        sumSlope += slopePct;
        if (slopePct < minSlope) minSlope = slopePct;
        if (slopePct > maxSlope) maxSlope = slopePct;
      }
    }

    return {
      method: "Horn (1981) 3x3 Finite Difference Algorithm",
      cellResolutionMeters: cellResMeters,
      slopePctGrid,
      slopeDegGrid,
      stats: {
        validCells: validCount,
        meanSlopePct: validCount > 0 ? parseFloat((sumSlope / validCount).toFixed(2)) : 0,
        minSlopePct: isFinite(minSlope) ? parseFloat(minSlope.toFixed(2)) : 0,
        maxSlopePct: isFinite(maxSlope) ? parseFloat(maxSlope.toFixed(2)) : 0,
      },
    };
  }
}

module.exports = {
  TerrainEngine,
};
