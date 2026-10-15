/**
 * @file catalog_registry.js
 * @description Authoritative Registry of Geospatial Datasets, Providers, and Sensor Specifications.
 * Strict metadata provenance standards compliant with ISO 19115 and FGDC CSDGM.
 */

const DATASET_CATALOG = {
  // 1. OPTICAL MULTISPECTRAL SENSORS
  sentinel2_l2a: {
    id: "sentinel2_l2a",
    name: "Copernicus Sentinel-2 MSI Level-2A",
    provider: "European Space Agency (ESA) / European Commission",
    product_level: "Level-2A (Surface Reflectance / BOA)",
    description: "Multispectral optical imagery with bottom-of-atmosphere reflectance correction",
    spatial_resolution_meters: 10,
    temporal_resolution_days: 5,
    projection_native: "UTM / WGS 84 (per tile MGRS)",
    license: "Copernicus Open Access / Creative Commons IGO",
    bands: {
      B02: { name: "Blue", central_wavelength_nm: 492.4, resolution_m: 10 },
      B03: { name: "Green", central_wavelength_nm: 559.8, resolution_m: 10 },
      B04: { name: "Red", central_wavelength_nm: 664.6, resolution_m: 10 },
      B08: { name: "NIR (Broad)", central_wavelength_nm: 832.8, resolution_m: 10 },
      B11: { name: "SWIR-1", central_wavelength_nm: 1610.4, resolution_m: 20 },
      B12: { name: "SWIR-2", central_wavelength_nm: 2190.0, resolution_m: 20 },
    },
    required_for: ["NDVI", "NDBI", "MNDWI", "LULC"],
    quality_requirements: {
      max_cloud_cover_percent: 20,
      must_have_scl_band: true, // Scene Classification Layer
    },
    primary_stac_endpoint: "https://planetarycomputer.microsoft.com/api/stac/v1",
    collection_id: "sentinel-2-l2a",
    alternative_endpoints: [
      "https://earth-search.aws.element84.com/v1",
      "https://sh.dataspace.copernicus.eu/opensearch/request",
    ],
    doi: "10.5270/S2_-znk9xs4",
  },

  landsat_8_9_c2_l2: {
    id: "landsat_8_9_c2_l2",
    name: "USGS Landsat 8/9 OLI/TIRS Collection 2 Level-2",
    provider: "United States Geological Survey (USGS) / NASA",
    product_level: "Collection 2 Level-2 Surface Reflectance & Surface Temperature",
    description: "Calibrated multispectral and thermal infrared surface observations",
    spatial_resolution_meters: 30,
    temporal_resolution_days: 16,
    projection_native: "Universal Transverse Mercator (UTM)",
    license: "USGS Public Domain",
    bands: {
      SR_B2: { name: "Blue", resolution_m: 30 },
      SR_B3: { name: "Green", resolution_m: 30 },
      SR_B4: { name: "Red", resolution_m: 30 },
      SR_B5: { name: "NIR", resolution_m: 30 },
      SR_B6: { name: "SWIR 1", resolution_m: 30 },
      ST_B10: { name: "Surface Temperature (Thermal)", resolution_m: 30, unit: "Kelvin" },
    },
    required_for: ["LST", "NDVI", "NDBI"],
    primary_stac_endpoint: "https://planetarycomputer.microsoft.com/api/stac/v1",
    collection_id: "landsat-c2-l2",
    doi: "10.5066/P9OGBGM6",
  },

  // 2. SYNTHETIC APERTURE RADAR (SAR)
  sentinel1_grd: {
    id: "sentinel1_grd",
    name: "Copernicus Sentinel-1 C-SAR Ground Range Detected (GRD)",
    provider: "European Space Agency (ESA) / Copernicus",
    product_level: "Level-1 GRD-HD Radiometric Terrain Corrected",
    description: "C-band Synthetic Aperture Radar active microwave observations",
    spatial_resolution_meters: 10,
    polarizations: ["VV", "VH"],
    units: "Backscatter Coefficient (sigma0 in dB)",
    license: "Copernicus Open Access",
    primary_stac_endpoint: "https://planetarycomputer.microsoft.com/api/stac/v1",
    collection_id: "sentinel-1-grd",
    doi: "10.5270/S1_-235x174",
  },

  // 3. DIGITAL ELEVATION MODELS (DEM)
  copernicus_dem_30: {
    id: "copernicus_dem_30",
    name: "Copernicus Digital Elevation Model GLO-30",
    provider: "European Space Agency (ESA) / Airbus",
    product_level: "GLO-30 (Public 1-arcsecond global coverage)",
    description: "High-accuracy digital surface model derived from TanDEM-X mission",
    spatial_resolution_meters: 30,
    vertical_datum: "EGM2008 Geoid",
    units: "meters (m above MSL)",
    license: "Open Data (Copernicus)",
    primary_stac_endpoint: "https://planetarycomputer.microsoft.com/api/stac/v1",
    collection_id: "copernicus-dem-glo-30",
    alternative_endpoints: ["https://copernicus-dem-30m.s3.amazonaws.com"],
    required_for: ["Slope", "Aspect", "Hydrology", "Elevation_Contour"],
  },

  demnas_big: {
    id: "demnas_big",
    name: "DEMNAS (Digital Elevation Model Nasional)",
    provider: "Badan Informasi Geospasial (BIG) Republik Indonesia",
    product_level: "National High-Resolution Seamless Elevation Model",
    description: "Model elevasi digital nasional integrasi IFSAR (5m), Terrasar-X (5m), dan ALOS PALSAR (11.25m)",
    spatial_resolution_meters: 8.1, // 0.27-arcsec
    vertical_datum: "EGM2008 Geoid",
    units: "meters",
    license: "Kebijakan Satu Peta (KSP) / BIG",
    official_portal: "https://tanahair.indonesia.go.id/demnas",
    required_for: ["Slope", "Hydrology", "High_Precision_Morfometri"],
  },

  // 4. DEMOGRAPHIC & SOCIOECONOMIC DATA
  worldpop_100m: {
    id: "worldpop_100m",
    name: "WorldPop Global High Resolution Population Denominators",
    provider: "WorldPop Research Group / University of Southampton",
    product_level: "Annual Unconstrained Individual Countries Population Counts",
    description: "Dasymetric modeled residential human population per 100m grid cell",
    spatial_resolution_meters: 100,
    temporal_coverage: "2000-2020",
    units: "People per grid cell (count)",
    license: "Creative Commons Attribution 4.0 International",
    official_api: "https://hub.worldpop.org/rest/data/pop/wpgp",
    doi: "10.5258/SOTON/WP00644",
  },

  viirs_dnb_vnl: {
    id: "viirs_dnb_vnl",
    name: "VIIRS Day/Night Band (DNB) Nighttime Lights",
    provider: "NOAA / Colorado School of Mines Earth Observation Group (EOG)",
    product_level: "VNL v2.2 Monthly / Annual Cloud-Free Composites",
    description: "Calibrated night-time lights average radiance from Suomi-NPP satellite",
    spatial_resolution_meters: 500, // 15 arc-seconds
    units: "nW/cm²/sr (nanowatts per square centimeter per steradian)",
    license: "Open Access for Academic Research",
    official_portal: "https://eogdata.mines.edu/products/vnl/",
    doi: "10.3390/rs9101063",
  },

  // 5. GLOBAL HUMAN SETTLEMENT & URBAN DYNAMICS
  ghsl_built_s: {
    id: "ghsl_built_s",
    name: "GHSL Global Human Settlement Layer (GHS-BUILT-S)",
    provider: "European Commission Joint Research Centre (JRC)",
    product_level: "GHS-BUILT-S R2023A (Epochs 1975-2020 at 5-year intervals)",
    description: "Spatial multi-temporal raster of built-up surface presence",
    spatial_resolution_meters: 100,
    units: "Epoch Year (1975, 1990, 2000, 2014, 2020)",
    license: "Open Access (JRC)",
    official_portal: "https://ghsl.jrc.ec.europa.eu/download.php",
    doi: "10.2760/470187",
  },

  // 6. FORESTRY & LAND COVER DYNAMICS
  gfw_hansen_treecover: {
    id: "gfw_hansen_treecover",
    name: "Hansen Global Forest Change v1.11 (2000-2023)",
    provider: "University of Maryland (UMD) / Global Forest Watch / Google",
    product_level: "Annual Forest Loss, Gain, and Year 2000 Tree Canopy Cover",
    description: "Time-series analysis of Landsat imagery characterizing global forest extent and change",
    spatial_resolution_meters: 30,
    units: "Tree canopy cover percentage (0-100%) & Loss Year (0-23)",
    license: "Creative Commons Attribution 4.0 International",
    official_portal: "https://storage.googleapis.com/earthenginepartners-hansen/GFC-2023-v1.11/",
    doi: "10.1126/science.1244693",
  },

  // 7. ATMOSPHERIC COMPOSITION & AIR QUALITY
  sentinel5p_tropomi_no2: {
    id: "sentinel5p_tropomi_no2",
    name: "Copernicus Sentinel-5P TROPOMI Tropospheric NO2 Column",
    provider: "ESA / KNMI / Copernicus",
    product_level: "L2/L3 Offline (OFFL) Nitrogen Dioxide Tropospheric Column",
    description: "Tropospheric vertical column density of nitrogen dioxide",
    spatial_resolution_meters: 3500, // 3.5 x 5.5 km
    units: "mol/m² (moles per square meter)",
    quality_filter: "qa_value >= 0.75 (cloud-free flag)",
    license: "Copernicus Open Access",
    primary_stac_endpoint: "https://planetarycomputer.microsoft.com/api/stac/v1",
    collection_id: "sentinel-5p-l2-netcdf",
    doi: "10.5270/S5P-s4vybp7",
  },

  // 8. CLIMATOLOGY & PRECIPITATION
  chirps_precip_v2: {
    id: "chirps_precip_v2",
    name: "CHIRPS v2.0 (Climate Hazards Group InfraRed Precipitation with Station Data)",
    provider: "Climate Hazards Center, UC Santa Barbara / USGS",
    product_level: "CHIRPS-2.0 Monthly / Annual Global Quasi-Global Coverage",
    description: "Gridded rainfall estimates incorporating satellite imagery with in-situ station data",
    spatial_resolution_meters: 5300, // 0.05 degrees
    units: "mm (millimeters)",
    license: "Public Domain / Open Data",
    official_portal: "https://data.chc.ucsb.edu/products/CHIRPS-2.0/",
    doi: "10.1038/sdata.2015.66",
  },

  // 9. SOLAR ENERGY POTENTIAL
  global_solar_atlas_ghi: {
    id: "global_solar_atlas_ghi",
    name: "Global Solar Atlas v2.0 (GHI & PVOUT)",
    provider: "World Bank Group / ESMAP / Solargis",
    product_level: "Long-term annual average GIS data (1999-2018)",
    description: "Global Horizontal Irradiation and Photovoltaic Power Potential",
    spatial_resolution_meters: 1000,
    units: "kWh/m²/day (Daily GHI) & kWh/kWp/year (PVOUT)",
    license: "Creative Commons Attribution 4.0 International",
    official_portal: "https://globalsolaratlas.info/download",
    doi: "10.1016/j.solener.2020.08.012",
  },

  // 10. LAND USE / LAND COVER (LULC)
  esa_worldcover_10m: {
    id: "esa_worldcover_10m",
    name: "ESA WorldCover 10m 2021 v200",
    provider: "European Space Agency (ESA) / VITO Remote Sensing",
    product_level: "Global Land Cover Product v200 (11 classes)",
    description: "Machine-learning classified land cover map based on Sentinel-1 and Sentinel-2 data",
    spatial_resolution_meters: 10,
    classes: {
      10: "Tree cover",
      20: "Shrubland",
      30: "Grassland",
      40: "Cropland",
      50: "Built-up",
      60: "Bare / sparse vegetation",
      70: "Snow and ice",
      80: "Permanent water bodies",
      90: "Herbaceous wetland",
      95: "Mangroves",
      100: "Moss and lichen",
    },
    license: "Creative Commons Attribution 4.0 International",
    primary_stac_endpoint: "https://planetarycomputer.microsoft.com/api/stac/v1",
    collection_id: "esa-worldcover",
    doi: "10.5281/zenodo.5571936",
  },

  // 11. INDONESIAN OFFICIAL GEOPORTALS (ONE MAP POLICY / INA-GEOPORTAL)
  rbi_big_25k: {
    id: "rbi_big_25k",
    name: "Peta Rupabumi Indonesia (RBI) Skala 1:25.000",
    provider: "Badan Informasi Geospasial (BIG)",
    product_level: "Peta Dasar Nasional Topografi Berstandar SNI 6502.2:2010",
    description: "Peta dasar topografi resmi memuat garis kontur, batas administrasi, hidrografi, dan fasilitas",
    scale_nominal: "1:25.000",
    projection_official: "WGS 84 / UTM Zona 46S-54S & Geografis (SRGI2013)",
    official_wms: "https://geoservices.big.go.id/rbi/rest/services/RBI/Peta_Rupabumi_Indonesia/MapServer",
    license: "Undang-Undang No. 4 Tahun 2011 tentang Informasi Geospasial",
  },

  inarisk_bnpb_hazard: {
    id: "inarisk_bnpb_hazard",
    name: "InaRISK Peta Bahaya Bencana Nasional",
    provider: "Badan Nasional Penanggulangan Bencana (BNPB)",
    product_level: "Indeks Bahaya Multi-Bencana Nasional (Perka BNPB No. 2/2012)",
    description: "Peta zonasi bahaya banjir, longsor, gempa bumi, tsunami, dan erupsi gunungapi resmi",
    official_wms: "https://inarisk.bnpb.go.id/arcgis/rest/services/layer_dasar",
    license: "Hak Akses Terbuka Informasi Publik Bencana BNPB",
  },

  gistaru_atrbpn_rtrw: {
    id: "gistaru_atrbpn_rtrw",
    name: "GISTARU Pola Ruang RTRW / RDTR Nasional",
    provider: "Kementerian Agraria dan Tata Ruang / Badan Pertanahan Nasional (ATR/BPN)",
    product_level: "Zonasi Tata Ruang Legalisasi Perda RTRW Provinsi & Kabupaten/Kota",
    description: "Pola ruang rencana struktur dan pola peruntukan ruang (Kawasan Lindung & Budidaya)",
    official_wms: "https://gistaru.atrbpn.go.id/arcgis/rest/services",
    license: "Undang-Undang Cipta Kerja No. 11/2020 & PP No. 21/2021 Penyelenggaraan Penataan Ruang",
  },

  // 12. PURE VISUAL BASEMAP (EXPLICIT SCIENTIFIC DISCLAIMER)
  esri_world_imagery_basemap: {
    id: "esri_world_imagery_basemap",
    name: "Esri World Imagery (Maxar/Airbus Optical Basemap)",
    provider: "Esri / Maxar / Earthstar Geographics",
    product_level: "Composite Visual Basemap Tile Service (Panchromatic Pan-sharpened RGB)",
    description: "Orthorectified high-resolution photographic background for geographic context ONLY",
    spatial_resolution_meters: 0.5,
    projection_native: "EPSG:3857 (Web Mercator)",
    scientific_disclaimer: "PERINGATAN ILMIAH: Ini adalah komposit foto RGB visual. TIDAK MENGANDUNG data reflektansi kalibrasi dan HARAM digunakan untuk kalkulasi indeks spektral (NDVI/NDBI/LST), elevasi, atau model fisik.",
    permitted_use: ["Visual Background Cartography", "Spatial Context Identification"],
    license: "Esri Master License Agreement for Web Mapping",
  },
};

module.exports = {
  DATASET_CATALOG,
};
