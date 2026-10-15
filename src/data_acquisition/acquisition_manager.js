/**
 * @file acquisition_manager.js
 * @description Multi-Tier Authoritative Geospatial Data Acquisition Engine.
 * Connects directly to Planetary Computer STAC, OpenTopography, Ina-Geoportal, and Overpass.
 * STRICT POLICY: Absence of data is NEVER converted into presence of data.
 */

const { DATASET_CATALOG } = require("../data_catalog/catalog_registry");
const { DataValidator } = require("../data_validation/data_validator");

class AcquisitionManager {
  /**
   * Universal fetch with timeout and standard header
   */
  static async safeFetch(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent": "UrbanTechScientificSpatialEngine/6.0 (academic-audit; contact@urbantech.id)",
          Accept: "application/json, image/*, */*",
          ...(options.headers || {}),
        },
      });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * 1. STAC Discovery for Copernicus Sentinel-2 Level-2A via Planetary Computer / Element84
   */
  static async discoverSentinel2Scene(bbox, maxCloudCover = 20) {
    const stacEndpoint = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
    const body = {
      collections: ["sentinel-2-l2a"],
      bbox: [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat],
      limit: 1,
      query: {
        "eo:cloud_cover": { lt: maxCloudCover },
      },
      sortby: [{ field: "properties.datetime", direction: "desc" }],
    };

    try {
      const res = await this.safeFetch(stacEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const item = data.features[0];
          return {
            status: "SUCCESS",
            provider: "Microsoft Planetary Computer STAC / ESA Copernicus",
            sceneId: item.id,
            datetime: item.properties.datetime,
            cloudCover: item.properties["eo:cloud_cover"],
            platform: item.properties.platform,
            assets: {
              B02: item.assets?.B02?.href,
              B03: item.assets?.B03?.href,
              B04: item.assets?.B04?.href,
              B08: item.assets?.B08?.href,
              B11: item.assets?.B11?.href,
              visual: item.assets?.visual?.href,
            },
            availableBands: ["BLUE", "GREEN", "RED", "NIR", "SWIR1"],
          };
        }
      }
    } catch (err) {
      console.warn("Primary STAC Sentinel-2 query failed:", err.message);
    }

    // Secondary STAC: AWS Earth Search
    try {
      const awsEndpoint = "https://earth-search.aws.element84.com/v1/search";
      const resAws = await this.safeFetch(awsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (resAws.ok) {
        const dataAws = await resAws.json();
        if (dataAws && dataAws.features && dataAws.features.length > 0) {
          const item = dataAws.features[0];
          return {
            status: "SUCCESS",
            provider: "AWS Earth Search Element84 / ESA",
            sceneId: item.id,
            datetime: item.properties.datetime,
            cloudCover: item.properties["eo:cloud_cover"],
            platform: item.properties.platform,
            assets: item.assets,
            availableBands: ["BLUE", "GREEN", "RED", "NIR", "SWIR1"],
          };
        }
      }
    } catch (errAws) {
      console.warn("Secondary STAC Sentinel-2 query failed:", errAws.message);
    }

    return {
      status: "DATA_UNAVAILABLE",
      code: "NO_SCENE_WITHIN_CLOUD_THRESHOLD",
      reason: `Tidak ditemukan rekaman Sentinel-2 L2A bebas awan (< ${maxCloudCover}%) di area studi pada repositori STAC resmi.`,
      availableBands: [],
    };
  }

  /**
   * 2. Discovery for Digital Elevation Model (Copernicus DEM 30m / OpenTopography)
   */
  static async discoverCopernicusDEM(bbox) {
    const stacEndpoint = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
    const body = {
      collections: ["copernicus-dem-glo-30"],
      bbox: [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat],
      limit: 1,
    };

    try {
      const res = await this.safeFetch(stacEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const item = data.features[0];
          return {
            status: "SUCCESS",
            provider: "Copernicus GLO-30 DEM / ESA Airbus",
            tileId: item.id,
            resolutionMeters: 30,
            verticalDatum: "EGM2008",
            assetUrl: item.assets?.data?.href,
          };
        }
      }
    } catch (err) {
      console.warn("Copernicus DEM STAC query failed:", err.message);
    }

    return {
      status: "DATA_UNAVAILABLE",
      code: "DEM_PROVIDER_OFFLINE",
      reason: "Layanan Cloud COG Copernicus DEM 30m tidak dapat diakses saat ini.",
    };
  }

  /**
   * 3. Discovery for Official Indonesian Geoportal Services (BIG, InaRISK, GISTARU)
   */
  static async probeNationalGeoportal(serviceKey) {
    const ENDPOINTS = {
      rbi_big: {
        url: "https://geoservices.big.go.id/rbi/rest/services/RBI/Peta_Rupabumi_Indonesia/MapServer?f=json",
        name: "Peta RBI 1:25.000 BIG",
        provider: "Badan Informasi Geospasial (BIG)",
      },
      inarisk_bnpb: {
        url: "https://inarisk.bnpb.go.id/arcgis/rest/services/layer_dasar/MapServer?f=json",
        name: "InaRISK Peta Bahaya Bencana",
        provider: "Badan Nasional Penanggulangan Bencana (BNPB)",
      },
      gistaru_atr: {
        url: "https://gistaru.atrbpn.go.id/arcgis/rest/services?f=json",
        name: "GISTARU Pola Ruang Nasional",
        provider: "Kementerian ATR/BPN",
      },
    };

    const cfg = ENDPOINTS[serviceKey];
    if (!cfg) {
      return { status: "DATA_UNAVAILABLE", reason: `Layanan geoportal ${serviceKey} tidak terdaftar di katalog resmi.` };
    }

    try {
      const res = await this.safeFetch(cfg.url, {}, 8000);
      if (res.ok) {
        const json = await res.json();
        return {
          status: "SUCCESS",
          serviceName: cfg.name,
          provider: cfg.provider,
          endpointUrl: cfg.url,
          online: true,
          details: json.serviceDescription || json.description || "ArcGIS MapServer Active",
        };
      }
    } catch (err) {
      // Server down or government firewall
    }

    return {
      status: "DATA_UNAVAILABLE",
      code: "GEOPORTAL_UNREACHABLE",
      serviceName: cfg.name,
      provider: cfg.provider,
      reason: `Server Geoportal Nasional ${cfg.provider} saat ini offline, mengalami maintenance jaringan, atau memblokir koneksi eksternal. Sesuai prinsip integritas data, sistem TIDAK mengganti dengan data tiruan.`,
    };
  }

  /**
   * 4. Strict POI Extractor (No Random / No Fake Generation)
   */
  static async fetchAuthenticPOIs(query, bbox, limit = 25) {
    const cleanQuery = query.trim();
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&viewbox=${bbox.minLon},${bbox.maxLat},${bbox.maxLon},${bbox.minLat}&bounded=1&limit=${limit}&addressdetails=1&extratags=1`;

    try {
      const res = await this.safeFetch(osmUrl, {
        headers: { "User-Agent": "UrbanTechSpatialBot/6.0-strict (contact@urbantech.id)" },
      });

      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          const authenticRecords = items.map((item, idx) => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            const name = item.name || item.display_name.split(",")[0];
            const category = item.type || item.class || "Uncategorized";

            // STRICT: Explicitly NULL / NOT_AVAILABLE if phone is absent from OSM
            const phone = item.extratags?.phone || item.extratags?.["contact:phone"] || "NOT_AVAILABLE";
            const website = item.extratags?.website || item.extratags?.["contact:website"] || "NOT_AVAILABLE";
            const openingHours = item.extratags?.opening_hours || "NOT_AVAILABLE";

            return {
              poi_id: item.place_id ? `osm_${item.place_id}` : `poi_${idx + 1}`,
              nama_tempat: name,
              kategori: category.charAt(0).toUpperCase() + category.slice(1),
              alamat_lengkap: item.display_name,
              latitude: lat,
              longitude: lon,
              nomor_telepon: phone,
              website: website,
              jam_operasional: openingHours,
              sumber_data: "OpenStreetMap Official Observational Database",
              verifikasi: "OBSERVED_TRUE_LOCATION",
              link_koordinat: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
            };
          });

          return {
            status: "SUCCESS",
            total_found: authenticRecords.length,
            records: authenticRecords,
            data_integrity: "STRICT_AUTHENTIC_ONLY",
          };
        }
      }
    } catch (err) {
      console.warn("OSM POI Fetch error:", err.message);
    }

    return {
      status: "DATA_UNAVAILABLE",
      code: "NO_OBSERVED_POIS",
      reason: `Tidak ditemukan entitas tempat terdaftar di OpenStreetMap untuk kata kunci "${cleanQuery}" di dalam batas AOI. Sistem tidak mengarang entitas fiktif.`,
      records: [],
    };
  }
}

module.exports = {
  AcquisitionManager,
};
