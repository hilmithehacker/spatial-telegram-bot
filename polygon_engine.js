if (typeof self === "undefined") {
  globalThis.self = globalThis;
}

let shpFunction = null;
async function getShpParser() {
  if (!shpFunction) {
    const mod = await import("shpjs");
    shpFunction = mod.default || mod.parseZip || mod;
  }
  return shpFunction;
}

/**
 * Helper: Ray-Casting algorithm for Point-in-Polygon
 */
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Pre-indexes polygon rings with individual bounding boxes for ultra-fast spatial querying
 */
function buildIndexedGeometry(geometry) {
  if (!geometry) return null;
  const polys = [];

  function addPoly(coords) {
    if (!Array.isArray(coords) || coords.length === 0) return;
    const extRing = coords[0];
    if (!Array.isArray(extRing) || extRing.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < extRing.length; i++) {
      const pt = extRing[i];
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
    }

    const holes = [];
    for (let h = 1; h < coords.length; h++) {
      const hRing = coords[h];
      let hMinX = Infinity, hMinY = Infinity, hMaxX = -Infinity, hMaxY = -Infinity;
      for (let i = 0; i < hRing.length; i++) {
        const pt = hRing[i];
        if (pt[0] < hMinX) hMinX = pt[0];
        if (pt[0] > hMaxX) hMaxX = pt[0];
        if (pt[1] < hMinY) hMinY = pt[1];
        if (pt[1] > hMaxY) hMaxY = pt[1];
      }
      holes.push({ ring: hRing, minX: hMinX, minY: hMinY, maxX: hMaxX, maxY: hMaxY });
    }

    polys.push({ extRing, minX, minY, maxX, maxY, holes });
  }

  if (geometry.type === "Polygon") {
    addPoly(geometry.coordinates);
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach(addPoly);
  }

  return polys;
}

function isPointInIndexed(lon, lat, indexedPolys) {
  if (!indexedPolys || indexedPolys.length === 0) return true;
  for (let i = 0; i < indexedPolys.length; i++) {
    const p = indexedPolys[i];
    if (lon < p.minX || lon > p.maxX || lat < p.minY || lat > p.maxY) continue;

    if (pointInRing(lon, lat, p.extRing)) {
      let inHole = false;
      for (let h = 0; h < p.holes.length; h++) {
        const hole = p.holes[h];
        if (lon >= hole.minX && lon <= hole.maxX && lat >= hole.minY && lat <= hole.maxY) {
          if (pointInRing(lon, lat, hole.ring)) {
            inHole = true;
            break;
          }
        }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

/**
 * Parses uploaded file (Shapefile .zip or .geojson/.json) into normalized spatial object
 */
async function parseUploadedSpatialFile(buffer, filename) {
  const ext = filename.toLowerCase().split(".").pop();
  let geojson = null;

  if (ext === "zip") {
    const parser = await getShpParser();
    geojson = await parser(buffer);
  } else if (ext === "geojson" || ext === "json") {
    const text = buffer.toString("utf-8");
    geojson = JSON.parse(text);
  } else {
    throw new Error(`Format .${ext} tidak didukung. Harap upload .geojson atau .zip berisi Shapefile (.shp).`);
  }

  let features = [];
  if (Array.isArray(geojson)) {
    geojson.forEach(fc => {
      if (fc && fc.features && Array.isArray(fc.features)) {
        features.push(...fc.features);
      } else if (fc && fc.type === "Feature") {
        features.push(fc);
      }
    });
  } else if (geojson && geojson.type === "FeatureCollection" && Array.isArray(geojson.features)) {
    features = geojson.features;
  } else if (geojson && geojson.type === "Feature") {
    features = [geojson];
  } else if (geojson && (geojson.type === "Polygon" || geojson.type === "MultiPolygon")) {
    features = [{ type: "Feature", geometry: geojson, properties: {} }];
  }

  features = features.filter(f => f && f.geometry && f.geometry.coordinates);

  if (features.length === 0) {
    throw new Error("Berkas Shapefile / GeoJSON tidak mengandung fitur poligon yang valid.");
  }

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  let totalPoints = 0;

  function processCoords(coords) {
    if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      const lon = coords[0];
      const lat = coords[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      totalPoints++;
    } else if (Array.isArray(coords)) {
      coords.forEach(processCoords);
    }
  }

  features.forEach(f => {
    if (f.geometry && f.geometry.coordinates) {
      processCoords(f.geometry.coordinates);
    }
  });

  if (!isFinite(minLon) || !isFinite(minLat) || !isFinite(maxLon) || !isFinite(maxLat)) {
    throw new Error("Gagal mengekstrak koordinat poligon dari berkas yang diupload.");
  }

  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;
  const margin = 0.02;
  const paddedMinLat = minLat - latSpan * margin;
  const paddedMaxLat = maxLat + latSpan * margin;
  const paddedMinLon = minLon - lonSpan * margin;
  const paddedMaxLon = maxLon + lonSpan * margin;

  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  const widthM = (maxLon - minLon) * 111320 * Math.cos((centerLat * Math.PI) / 180);
  const heightM = (maxLat - minLat) * 110574;
  const approxAreaHa = Math.round((Math.abs(widthM * heightM) / 10000) * 0.7);

  const baseName = filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-]/g, "_");

  let primaryGeom = null;
  if (features.length === 1) {
    primaryGeom = features[0].geometry;
  } else {
    const polyCoords = [];
    features.forEach(f => {
      if (f.geometry.type === "Polygon") {
        polyCoords.push(f.geometry.coordinates);
      } else if (f.geometry.type === "MultiPolygon") {
        polyCoords.push(...f.geometry.coordinates);
      }
    });
    if (polyCoords.length > 0) {
      primaryGeom = {
        type: "MultiPolygon",
        coordinates: polyCoords
      };
    }
  }

  return {
    sourceType: ext.toUpperCase(),
    filename,
    baseName,
    featureCount: features.length,
    pointCount: totalPoints,
    approxAreaHa: Math.max(1, approxAreaHa),
    centerLat,
    centerLon,
    bbox: {
      name: `Upload Custom (${baseName})`,
      type: `Berkas ${ext.toUpperCase()}`,
      centerLat,
      centerLon,
      minLon: paddedMinLon,
      minLat: paddedMinLat,
      maxLon: paddedMaxLon,
      maxLat: paddedMaxLat,
      widthMeters: Math.round(Math.abs(widthM)),
      rawGeom: primaryGeom
    }
  };
}

/**
 * Builds an ultra-fast 2D boolean mask using Spatial Index Bounding Boxes
 */
function generateGeometryMask(width, height, minLon, minLat, maxLon, maxLat, geometry) {
  if (!geometry) return null;
  const indexedPolys = buildIndexedGeometry(geometry);
  if (!indexedPolys || indexedPolys.length === 0) return null;

  const mask = new Uint8Array(width * height);
  const dLon = (maxLon - minLon) / width;
  const dLat = (maxLat - minLat) / height;

  let idx = 0;
  for (let y = 0; y < height; y++) {
    const lat = maxLat - (y + 0.5) * dLat;
    for (let x = 0; x < width; x++) {
      const lon = minLon + (x + 0.5) * dLon;
      mask[idx] = isPointInIndexed(lon, lat, indexedPolys) ? 1 : 0;
      idx++;
    }
  }

  return mask;
}

module.exports = {
  parseUploadedSpatialFile,
  generateGeometryMask,
  buildIndexedGeometry,
  isPointInIndexed,
};
