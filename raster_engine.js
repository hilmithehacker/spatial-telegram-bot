/**
 * @file raster_engine.js
 * @description Scientific GeoTIFF & Remote Sensing Acquisition Engine.
 * PURGED: All pseudo-elevation, RGB brightness hacking, and fake spectral indices.
 * ENFORCES: SCIENTIFIC_STRICT_MODE and Quality Gate compliance.
 */

const fs = require("fs");
const path = require("path");
const GeoTIFF = require("geotiff");
const { Jimp } = require("jimp");
const { generateGeometryMask } = require("./polygon_engine");
const { Preprocessor } = require("./src/preprocessing/preprocessor");
const { AcquisitionManager } = require("./src/data_acquisition/acquisition_manager");
const { DataValidator } = require("./src/data_validation/data_validator");
const { SpectralEngine } = require("./src/analysis_engine/spectral_engine");
const { TerrainEngine } = require("./src/analysis_engine/terrain_engine");
const { Classifier } = require("./src/classification_engine/classifier");
const { ProvenanceTracker } = require("./src/provenance_engine/provenance_tracker");
const { ValidationManager } = require("./src/validation_engine/validation_manager");
const { UncertaintyEstimator } = require("./src/uncertainty_engine/uncertainty_estimator");
const { ReportGenerator } = require("./src/reporting_engine/report_generator");
const { DATASET_CATALOG } = require("./src/data_catalog/catalog_registry");
const { SCIENTIFIC_REFERENCES } = require("./src/reference_engine/reference_registry");

function rgbaToInt(r, g, b, a = 255) {
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

const EPSG3857_PRJ = `PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","3857"]]`;

function lonLatToMercator(lon, lat) {
  const x = (lon * 20037508.34) / 180;
  let y = Math.log(Math.tan(((90 + Math.max(-85, Math.min(85, lat))) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return { x, y };
}

/**
 * 1. Resolves Region Name or Coordinates into Spatial Bounding Box (WGS84)
 */
async function resolveBoundingBox(query) {
  const clean = query.trim();

  // Coordinates match
  const coordMatch = clean.match(/([-+]?\d+\.?\d*)[,\s]+([-+]?\d+\.?\d*)/);
  if (coordMatch && !isNaN(parseFloat(coordMatch[1])) && !isNaN(parseFloat(coordMatch[2]))) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    const d = 0.035;
    return {
      name: `Area Koordinat (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
      type: "Coordinates",
      centerLat: lat,
      centerLon: lon,
      minLon: lon - d,
      minLat: lat - d,
      maxLon: lon + d,
      maxLat: lat + d,
      widthMeters: Math.round(d * 2 * 111320),
    };
  }

  // Geocoding via Nominatim OpenStreetMap
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&addressdetails=1&countrycodes=id&limit=1&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "UrbanTechGeoTIFFEngine/6.0 (scientific-audit; contact@urbantech.id)" },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const bbox = item.boundingbox;
        let minLat = parseFloat(bbox[0]);
        let maxLat = parseFloat(bbox[1]);
        let minLon = parseFloat(bbox[2]);
        let maxLon = parseFloat(bbox[3]);

        let latSpan = maxLat - minLat;
        let lonSpan = maxLon - minLon;
        const margin = 0.02;
        minLat -= latSpan * margin;
        maxLat += latSpan * margin;
        minLon -= lonSpan * margin;
        maxLon += lonSpan * margin;

        const maxSpan = 3.5;
        if (maxLat - minLat > maxSpan) {
          const midLat = (minLat + maxLat) / 2;
          minLat = midLat - maxSpan / 2;
          maxLat = midLat + maxSpan / 2;
        }
        if (maxLon - minLon > maxSpan) {
          const midLon = (minLon + maxLon) / 2;
          minLon = midLon - maxSpan / 2;
          maxLon = midLon + maxSpan / 2;
        }

        return {
          name: item.display_name.split(",").slice(0, 3).join(","),
          type: item.addresstype || item.type || "Administrative",
          centerLat: parseFloat(item.lat),
          centerLon: parseFloat(item.lon),
          minLon,
          minLat,
          maxLon,
          maxLat,
          widthMeters: Math.round((maxLon - minLon) * 111320),
          rawGeom: (item.geojson && (item.geojson.type === "Polygon" || item.geojson.type === "MultiPolygon")) ? item.geojson : null,
        };
      }
    }
  } catch (err) {
    console.warn("Geocoding fetch failed:", err.message);
  }

  // Fallback default (Kota Semarang)
  return {
    name: clean,
    type: "Default Region",
    centerLat: -7.0051,
    centerLon: 110.4381,
    minLon: 110.35,
    minLat: -7.08,
    maxLon: 110.50,
    maxLat: -6.94,
    widthMeters: 16000,
  };
}

async function searchLocationCandidates(query) {
  const clean = query.trim();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&addressdetails=1&countrycodes=id&limit=5&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "UrbanTechGeoTIFFEngine/6.0 (contact@urbantech.id)" },
    });

    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return list.map((item, idx) => {
          let minLat = parseFloat(item.boundingbox[0]);
          let maxLat = parseFloat(item.boundingbox[1]);
          let minLon = parseFloat(item.boundingbox[2]);
          let maxLon = parseFloat(item.boundingbox[3]);

          let prefix = "📍";
          if (item.addresstype === "county" || (item.display_name && item.display_name.toLowerCase().includes("kabupaten"))) {
            prefix = "🏛️ Kab.";
          } else if (item.addresstype === "city" || (item.display_name && item.display_name.toLowerCase().includes("kota"))) {
            prefix = "🏙️ Kota";
          } else if (item.addresstype === "subdistrict" || item.addresstype === "district") {
            prefix = "🏘️ Kec.";
          } else if (item.addresstype === "village") {
            prefix = "🏡 Desa";
          }

          const state = item.address?.state ? item.address.state.replace("Provinsi ", "") : "";
          const name = item.name || item.display_name.split(",")[0];
          const title = `${prefix} ${name}${state ? " (" + state + ")" : ""}`;

          return {
            id: `cand_${idx}`,
            title,
            subtitle: item.display_name.split(",").slice(0, 3).join(", "),
            bbox: {
              name: title,
              type: item.addresstype || "Wilayah",
              centerLat: parseFloat(item.lat),
              centerLon: parseFloat(item.lon),
              minLon,
              minLat,
              maxLon,
              maxLat,
              widthMeters: Math.round((maxLon - minLon) * 111320),
              rawGeom: (item.geojson && (item.geojson.type === "Polygon" || item.geojson.type === "MultiPolygon")) ? item.geojson : null,
            },
          };
        });
      }
    }
  } catch (err) {
    console.warn("searchLocationCandidates error:", err.message);
  }
  return [];
}

/**
 * Fetch Visual Basemap Imagery (Maxar/Airbus Optical RGB)
 * STRICT: Marked exclusively as "Visual Photographic Basemap"
 */
async function fetchImageryBuffer(bbox, targetDim = 1024) {
  const minMeters = lonLatToMercator(bbox.minLon, bbox.minLat);
  const maxMeters = lonLatToMercator(bbox.maxLon, bbox.maxLat);
  const aspect = Math.abs((maxMeters.x - minMeters.x) / (maxMeters.y - minMeters.y));

  let width = Math.min(1800, Math.max(512, targetDim));
  let height = Math.round(width / aspect);
  if (height > 1800) { height = 1800; width = Math.round(height * aspect); }
  width = Math.max(512, Math.min(1800, width));
  height = Math.max(512, Math.min(1800, height));

  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minMeters.x},${minMeters.y},${maxMeters.x},${maxMeters.y}&bboxSR=3857&imageSR=3857&size=${width},${height}&format=png&f=image`;

  const res = await fetch(url, {
    headers: { "User-Agent": "UrbanTechGeoTIFFEngine/6.0 (contact@urbantech.id)" },
  });

  if (res.ok) {
    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      minMeters,
      maxMeters,
      width,
      height,
    };
  }
  throw new Error("Gagal mengambil citra basemap optik dari server ArcGIS.");
}

/**
 * Master Spatial Generation Engine (Strict Scientific Mode)
 */
async function generateUniversalGeoTIFF(arg1, arg2, arg3, arg4 = "hd") {
  const exportDir = path.join(__dirname, "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  let regionName = "Wilayah Studi";
  let bbox = { minLon: 110.35, minLat: -7.08, maxLon: 110.50, maxLat: -6.94 };
  let sensorType = "vhr_optik";
  let resolutionOption = "hd";

  if (typeof arg2 === "object" && arg2.minLon !== undefined) {
    bbox = arg2;
    regionName = typeof arg1 === "string" ? arg1 : "Wilayah";
    sensorType = typeof arg3 === "string" ? arg3 : "vhr_optik";
    resolutionOption = arg4 || "hd";
  } else if (typeof arg3 === "object" && arg3.minLon !== undefined) {
    sensorType = typeof arg1 === "string" ? arg1 : "vhr_optik";
    regionName = typeof arg2 === "string" ? arg2 : "Wilayah";
    bbox = arg3;
    resolutionOption = arg4 || "hd";
  }

  const utm = Preprocessor.getIndonesianUtmZone(bbox.centerLon || (bbox.minLon + bbox.maxLon) / 2, bbox.centerLat || (bbox.minLat + bbox.maxLat) / 2);

  // Initialize Provenance Record
  const provenance = ProvenanceTracker.createRecord({
    toolId: sensorType,
    toolName: DATASET_CATALOG[sensorType]?.name || sensorType,
    datasetId: sensorType,
    datasetCatalogMeta: DATASET_CATALOG[sensorType],
    aoiQuery: regionName,
    bbox,
    utmZone: utm,
  });

  // -------------------------------------------------------------
  // SCIENTIFIC QUALITY GATE & ROUTING
  // -------------------------------------------------------------

  // A. PURE VISUAL OPTICAL BASEMAP (PERMITTED WITH EXPLICIT DISCLAIMER)
  if (sensorType === "vhr_optik" || sensorType === "satellite_rgb") {
    let targetDim = resolutionOption === "2k" ? 1600 : (resolutionOption === "fhd" ? 1400 : 1024);
    const safeName = regionName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 18);
    const baseFilename = `vhr_optik_${safeName}_${Date.now().toString().slice(-4)}`;
    const tifPath = path.join(exportDir, `${baseFilename}.tif`);
    const previewPngPath = path.join(exportDir, `${baseFilename}_preview.png`);

    const { buffer: imgBuffer, minMeters, maxMeters, width, height } = await fetchImageryBuffer(bbox, targetDim);
    const img = await Jimp.read(imgBuffer);

    const mask = (bbox && bbox.rawGeom) ? generateGeometryMask(width, height, bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat, bbox.rawGeom) : null;
    const rawRgb = new Uint8Array(width * height * 3);
    const previewImg = new Jimp({ width, height, color: 0x00000000 });

    let ptr = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isInside = !mask || mask[y * width + x] === 1;

        if (!isInside) {
          rawRgb[ptr++] = 0; rawRgb[ptr++] = 0; rawRgb[ptr++] = 0;
          previewImg.setPixelColor(0x00000000, x, y);
          continue;
        }

        const r = img.bitmap.data[idx];
        const g = img.bitmap.data[idx + 1];
        const b = img.bitmap.data[idx + 2];

        rawRgb[ptr++] = r; rawRgb[ptr++] = g; rawRgb[ptr++] = b;
        previewImg.setPixelColor(rgbaToInt(r, g, b, 255), x, y);
      }
    }

    await previewImg.write(previewPngPath);

    const pixelScaleX = (maxMeters.x - minMeters.x) / width;
    const pixelScaleY = (maxMeters.y - minMeters.y) / height;

    const tifArrayBuffer = GeoTIFF.writeArrayBuffer(rawRgb, {
      width,
      height,
      GTModelTypeGeoKey: 1, // Projected
      GTRasterTypeGeoKey: 1,
      ProjectedCSTypeGeoKey: 3857,
      ModelTiepoint: [0, 0, 0, minMeters.x, maxMeters.y, 0],
      ModelPixelScale: [pixelScaleX, pixelScaleY, 0],
      PhotometricInterpretation: 2,
      SamplesPerPixel: 3,
    });

    fs.writeFileSync(tifPath, Buffer.from(tifArrayBuffer));
    fs.writeFileSync(tifPath.replace(/\.tif$/i, ".tfw"), `${pixelScaleX.toFixed(8)}\n0\n0\n${(-pixelScaleY).toFixed(8)}\n${minMeters.x.toFixed(8)}\n${maxMeters.y.toFixed(8)}\n`);
    fs.writeFileSync(tifPath.replace(/\.tif$/i, ".prj"), EPSG3857_PRJ);

    ProvenanceTracker.finalizeRecord(provenance, { type: "Visual Basemap", path: tifPath });

    return {
      status: "SUCCESS",
      type: "Citra Satelit Optik True Color (Visual Basemap)",
      format: "GeoTIFF (.TIF)",
      crs: "EPSG:3857 (WGS 84 / Pseudo-Mercator)",
      resolution: `${pixelScaleX.toFixed(2)} m/pixel`,
      width,
      height,
      tifPath,
      previewPngPath,
      fileSizeMb: (tifArrayBuffer.byteLength / (1024 * 1024)).toFixed(2),
      bbox,
      provenance,
      isAuthenticBasemap: true,
      scientific_disclaimer: "PERHATIAN: Ini adalah komposit ortofoto optik visual (Esri/Maxar). Sesuai kaidah penginderaan jauh, citra ini tidak mengandung pita radiometrik murni untuk kalkulasi indeks spektral atau elevasi.",
    };
  }

  // B. MULTISPECTRAL SENSORS & INDICES (SENTINEL-2, LANDSAT, RADAR, NDVI, NDBI)
  if (["sentinel2", "landsat", "radar", "ndvi", "ndbi"].includes(sensorType)) {
    // Probe STAC API for genuine scene
    const discovery = await AcquisitionManager.discoverSentinel2Scene(bbox);

    if (discovery.status !== "SUCCESS") {
      const blockedReport = ReportGenerator.generateBlockedReport({
        toolName: DATASET_CATALOG[sensorType]?.name || sensorType,
        reason: discovery.reason || "Ketiadaan data pita spektral fisik terkalibrasi.",
        requiredInputs: DATASET_CATALOG[sensorType]?.required_for || ["Pita Spektral Fisik Terkalibrasi BOA"],
        availableInputs: ["Visual Basemap RGB Saja"],
      });

      return {
        status: "ANALYSIS_BLOCKED",
        code: "SPECTRAL_DATA_UNAVAILABLE",
        message: blockedReport,
        provenance,
      };
    }
  }

  // C. DIGITAL ELEVATION MODELS & MORPHOMETRY (DEM, DSM, SLOPE, HYDROLOGY)
  if (["dem", "dsm", "slope", "hydro"].includes(sensorType)) {
    const demDiscovery = await AcquisitionManager.discoverCopernicusDEM(bbox);

    if (demDiscovery.status !== "SUCCESS") {
      const blockedReport = ReportGenerator.generateBlockedReport({
        toolName: DATASET_CATALOG[sensorType]?.name || sensorType,
        reason: "Layanan DEM fisik resmi (Copernicus DEM GLO-30 / DEMNAS) tidak dapat diakses untuk koordinat ini. Sistem menolak membuat elevasi sintetis dari citra visual RGB.",
        requiredInputs: ["Digital Elevation Model (DEM) Fisik Riil"],
        availableInputs: ["Citra Optik Visual Tanpa Data Ketinggian"],
      });

      return {
        status: "ANALYSIS_BLOCKED",
        code: "DEM_UNAVAILABLE",
        message: blockedReport,
        provenance,
      };
    }
  }

  // D. THERMAL & DISASTER HAZARD (LST, HAZARD)
  if (["lst", "hazard"].includes(sensorType)) {
    const blockedReport = ReportGenerator.generateBlockedReport({
      toolName: DATASET_CATALOG[sensorType]?.name || sensorType,
      reason: "Analisis memerlukan data fisik termal inframerah (TIR) / layer resmi BNPB. Menghitung suhu atau bahaya dari kecerahan foto satelit dilarang keras oleh prinsip audit ilmiah.",
      requiredInputs: ["Thermal Infrared Sensor (Landsat TIRS/MODIS) / InaRISK WMS"],
      availableInputs: ["Data Optik Siang Hari Saja"],
    });

    return {
      status: "ANALYSIS_BLOCKED",
      code: "METHOD_INPUT_MISMATCH",
      message: blockedReport,
      provenance,
    };
  }

  // Fallback safe blocking
  return {
    status: "ANALYSIS_BLOCKED",
    code: "UNSUPPORTED_OR_UNVERIFIED_PIPELINE",
    message: ReportGenerator.generateBlockedReport({
      toolName: sensorType,
      reason: "Pipeline analisis belum terhubung ke sumber data terverifikasi.",
      requiredInputs: ["Sensor Observasi Riil"],
      availableInputs: [],
    }),
    provenance,
  };
}

module.exports = {
  resolveBoundingBox,
  searchLocationCandidates,
  generateUniversalGeoTIFF,
};
