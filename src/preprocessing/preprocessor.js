/**
 * @file preprocessor.js
 * @description Coordinate Transformation, UTM Zone Calculation & Spatial Preprocessing Engine.
 * Conforms to Indonesian Spatial Reference System (SRGI 2013 / WGS 84 UTM).
 */

class Preprocessor {
  /**
   * Computes the exact official Indonesian UTM Zone from Longitude and Latitude
   * Indonesia spans from 95°E to 141°E (Zones 46 to 54, Southern & Northern Hemispheres)
   */
  static getIndonesianUtmZone(lon, lat) {
    const zoneNum = Math.floor((lon + 180) / 6) + 1;
    const isSouth = lat < 0;
    const hemisphere = isSouth ? "S" : "N";
    const epsg = isSouth ? 32700 + zoneNum : 32600 + zoneNum;

    return {
      zoneNumber: zoneNum,
      hemisphere,
      name: `WGS 84 / UTM Zone ${zoneNum}${hemisphere}`,
      epsg: `EPSG:${epsg}`,
      epsgCode: epsg,
      centralMeridian: zoneNum * 6 - 183,
      isIndonesianTerritory: zoneNum >= 46 && zoneNum <= 54 && lat >= -11.5 && lat <= 6.5,
      wkt: `PROJCS["WGS 84 / UTM zone ${zoneNum}${hemisphere}",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",${zoneNum * 6 - 183}],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",${isSouth ? 10000000 : 0}],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","${epsg}"]]`,
    };
  }

  /**
   * Accurate Geodesic Area Calculation in Hectares (Karney WGS84 Ellipsoid Formulation)
   */
  static calculateGeodesicAreaHa(bbox) {
    const a = 6378137.0; // WGS84 Semi-major axis (meters)
    const e2 = 0.00669437999014; // First eccentricity squared

    const toRad = Math.PI / 180;
    const lat1 = bbox.minLat * toRad;
    const lat2 = bbox.maxLat * toRad;
    const lon1 = bbox.minLon * toRad;
    const lon2 = bbox.maxLon * toRad;

    const deltaLon = Math.abs(lon2 - lon1);

    // Analytical integral of authalic surface on ellipsoid
    function q(lat) {
      const sinLat = Math.sin(lat);
      return (1 - e2) * (sinLat / (1 - e2 * sinLat * sinLat) - (1 / (2 * Math.sqrt(e2))) * Math.log((1 - Math.sqrt(e2) * sinLat) / (1 + Math.sqrt(e2) * sinLat)));
    }

    const areaM2 = (a * a * deltaLon * (q(lat2) - q(lat1))) / 2.0;
    const areaHa = areaM2 / 10000.0;
    const areaKm2 = areaM2 / 1000000.0;

    return {
      areaM2: Math.round(areaM2),
      areaHa: Math.round(areaHa * 100) / 100,
      areaKm2: Math.round(areaKm2 * 100) / 100,
    };
  }

  /**
   * Generates standard ESRI World File (.tfw) and WKT Projection (.prj)
   */
  static generateTfwAndPrj(bbox, width, height, utmZone) {
    const pixelScaleX = (bbox.maxLon - bbox.minLon) / width;
    const pixelScaleY = (bbox.maxLat - bbox.minLat) / height;
    const originX = bbox.minLon + pixelScaleX / 2;
    const originY = bbox.maxLat - pixelScaleY / 2;

    const tfwContent = `${pixelScaleX.toFixed(10)}\n0.0000000000\n0.0000000000\n${(-pixelScaleY).toFixed(10)}\n${originX.toFixed(10)}\n${originY.toFixed(10)}\n`;
    const prjContent = utmZone?.wkt || `GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]`;

    return {
      tfwContent,
      prjContent,
      pixelScaleX,
      pixelScaleY,
    };
  }
}

module.exports = {
  Preprocessor,
};
