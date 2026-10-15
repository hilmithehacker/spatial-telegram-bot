const fs = require("fs");
const path = require("path");

/**
 * 🗺️ QML & CARTOGRAPHIC STYLING ENGINE FOR QGIS
 * Generates official XML .QML styling files and calculates precision metric UTM metrics.
 */

/**
 * Auto-detect Indonesian UTM Zone and EPSG Code from Lon/Lat
 */
function getIndonesianUtmZone(lon, lat) {
  const zoneNumber = Math.floor((lon + 180) / 6) + 1;
  const isSouth = lat < 0;
  const epsg = isSouth ? 32700 + zoneNumber : 32600 + zoneNumber;
  const hemisphere = isSouth ? "South" : "North";
  const name = `WGS 84 / UTM Zone ${zoneNumber}${isSouth ? "S" : "N"} (EPSG:${epsg})`;

  return {
    zoneNumber,
    isSouth,
    epsg,
    name,
    authority: "Badan Informasi Geospasial (BIG) / SRGI 2013",
  };
}

/**
 * Calculate precise geodesic area in Hectares (ha) and km²
 */
function calculateGeodesicAreaHa(bbox) {
  const R = 6378137; // WGS84 Earth radius in meters
  const dLat = (bbox.maxLat - bbox.minLat) * (Math.PI / 180);
  const dLon = (bbox.maxLon - bbox.minLon) * (Math.PI / 180);
  const midLat = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);

  const widthMeters = dLon * R * Math.cos(midLat);
  const heightMeters = dLat * R;
  const areaM2 = widthMeters * heightMeters;
  const areaHa = areaM2 / 10000;
  const areaKm2 = areaM2 / 1000000;

  return {
    areaM2: Math.round(areaM2),
    areaHa: parseFloat(areaHa.toFixed(2)),
    areaKm2: parseFloat(areaKm2.toFixed(2)),
    widthKm: parseFloat((widthMeters / 1000).toFixed(2)),
    heightKm: parseFloat((heightMeters / 1000).toFixed(2)),
  };
}

/**
 * Write a QGIS .QML Layer Style File
 */
function writeQmlStyle(tifPath, styleType, classEntries = []) {
  const qmlPath = tifPath.replace(/\.tif$/i, ".qml");

  let colorRampItems = "";
  for (const entry of classEntries) {
    // entry: { value, color: '#RRGGBB', label, alpha: 255 }
    colorRampItems += `        <item value="${entry.value}" label="${entry.label}" color="${entry.color}" alpha="${entry.alpha || 255}"/>\n`;
  }

  const qmlContent = `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis version="3.34.0" styleCategories="AllStyleCategories">
  <flags>
    <Identifiable>1</Identifiable>
    <Removable>1</Removable>
    <Searchable>1</Searchable>
  </flags>
  <customproperties>
    <Option type="Map">
      <Option name="WMSBackgroundLayer" type="bool" value="false"/>
      <Option name="WMSPublishDataSourceUrl" type="bool" value="false"/>
      <Option name="embeddedWidgets/count" type="int" value="0"/>
      <Option name="identify/format" type="QString" value="Value"/>
    </Option>
  </customproperties>
  <pipe-data-defined-properties>
    <Option type="Map">
      <Option name="name" type="QString" value=""/>
      <Option name="properties"/>
      <Option name="type" type="QString" value="collection"/>
    </Option>
  </pipe-data-defined-properties>
  <pipe>
    <provider>
      <resampling maxOversampling="2" zoomedOutResamplingMethod="nearestNeighbour" zoomedInResamplingMethod="nearestNeighbour" enabled="false"/>
    </provider>
    <rasterrenderer type="singlebandpseudocolor" opacity="1" alphaBand="-1" classificationMin="0" classificationMax="100" band="1">
      <rasterTransparency/>
      <minMaxOrigin>
        <limits>None</limits>
        <extent>WholeRaster</extent>
        <statAccuracy>Estimated</statAccuracy>
        <cumulativeCutLower>0.02</cumulativeCutLower>
        <cumulativeCutUpper>0.98</cumulativeCutUpper>
        <stdDevFactor>2</stdDevFactor>
      </minMaxOrigin>
      <rastershader>
        <colorrampshader minimumValue="0" maximumValue="100" classificationMode="2" colorRampType="EXACT" clip="0" labelPrecision="1">
${colorRampItems}        </colorrampshader>
      </rastershader>
    </rasterrenderer>
    <brightnesscontrast gamma="1" contrast="0" brightness="0"/>
    <huesaturation colorizeBlue="128" colorizeGreen="128" colorizeRed="255" colorizeOn="0" colorizeStrength="100" grayscaleMode="0" saturation="0"/>
    <rasterresampler maxOversampling="2"/>
    <resamplingStage>resamplingFilter</resamplingStage>
  </pipe>
  <blendMode>0</blendMode>
</qgis>`;

  fs.writeFileSync(qmlPath, qmlContent, "utf-8");
  return qmlPath;
}

/**
 * Standard Predefined Palettes & Classifications
 */
const CLASSIFICATION_PALETTES = {
  // 1. Kelerengan Permen PU No. 20/PRT/M/2007
  slope: [
    { value: 1, color: "#38A800", label: "Kelas 1 (0 - 8%): Datar / Sangat Layak Permukiman", alpha: 255 },
    { value: 2, color: "#79C900", label: "Kelas 2 (8 - 15%): Landai / Layak Permukiman", alpha: 255 },
    { value: 3, color: "#FFFF00", label: "Kelas 3 (15 - 25%): Agak Curam / Perkebunan & RTH", alpha: 255 },
    { value: 4, color: "#FF7F00", label: "Kelas 4 (25 - 45%): Curam / Penyangga Konservasi", alpha: 255 },
    { value: 5, color: "#700000", label: "Kelas 5 (> 45%): Sangat Curam / Hutan Lindung Mutlak", alpha: 255 },
  ],

  // 2. Dynamic World (Google & WRI NRT)
  dynamic_world: [
    { value: 1, color: "#419BDF", label: "Water (Badan Air & Danau)", alpha: 255 },
    { value: 2, color: "#397D49", label: "Trees (Pohon & Hutan)", alpha: 255 },
    { value: 3, color: "#88B053", label: "Grass (Padang Rumput)", alpha: 255 },
    { value: 4, color: "#7A87C6", label: "Flooded Veg (Lahan Basah & Rawa)", alpha: 255 },
    { value: 5, color: "#E49635", label: "Crops (Pertanian & Sawah)", alpha: 255 },
    { value: 6, color: "#DFC35A", label: "Shrub & Scrub (Semak Belukar)", alpha: 255 },
    { value: 7, color: "#C4281B", label: "Built Area (Kawasan Terbangun/Urban)", alpha: 255 },
    { value: 8, color: "#A59B8F", label: "Bare Ground (Lahan Terbuka)", alpha: 255 },
    { value: 9, color: "#B39FE1", label: "Snow & Ice (Salju)", alpha: 255 },
  ],

  // 3. ESRI Multi-Year Land Cover
  esri_landcover: [
    { value: 1, color: "#1A5BAB", label: "Water (Perairan)", alpha: 255 },
    { value: 2, color: "#358221", label: "Trees (Hutan Primer & Sekunder)", alpha: 255 },
    { value: 3, color: "#2CA9E1", label: "Flooded Veg (Vegetasi Tergenang)", alpha: 255 },
    { value: 4, color: "#FFDB5C", label: "Crops (Lahan Pertanian)", alpha: 255 },
    { value: 5, color: "#ED022A", label: "Built Area (Kawasan Terbangun)", alpha: 255 },
    { value: 6, color: "#EDE9E4", label: "Bare Ground (Tanah Terbuka)", alpha: 255 },
    { value: 7, color: "#93C639", label: "Rangeland (Semak & Savana)", alpha: 255 },
  ],

  // 4. Multi-Hazard InaRISK
  hazard: [
    { value: 1, color: "#38A800", label: "Zona Risiko Rendah / Aman Relatif", alpha: 255 },
    { value: 2, color: "#FFFF00", label: "Zona Risiko Sedang / Waspada", alpha: 255 },
    { value: 3, color: "#0070FF", label: "Zona Kerawanan Banjir & Genangan Rob", alpha: 255 },
    { value: 4, color: "#FF0000", label: "Zona Kerentanan Gerakan Tanah & Longsor Tinggi", alpha: 255 },
  ],

  // 5. GHSL Built-up Epoch
  ghsl_epoch: [
    { value: 1, color: "#8C3C1E", label: "Pra-1975 (Pusat Kota Tua Historis)", alpha: 255 },
    { value: 2, color: "#E6AF28", label: "1975 - 1990 (Ekspansi Urban Awal)", alpha: 255 },
    { value: 3, color: "#EB6E23", label: "1990 - 2000 (Pemekaran Perkotaan)", alpha: 255 },
    { value: 4, color: "#D72D32", label: "2000 - 2015 (Pertumbuhan Aglomerasi)", alpha: 255 },
    { value: 5, color: "#C31E91", label: "2015 - 2024 (Pembangunan Baru & Kawasan Industri)", alpha: 255 },
  ],
};

module.exports = {
  getIndonesianUtmZone,
  calculateGeodesicAreaHa,
  writeQmlStyle,
  CLASSIFICATION_PALETTES,
};
