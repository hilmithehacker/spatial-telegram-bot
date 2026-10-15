/**
 * @file reference_registry.js
 * @description Comprehensive Peer-Reviewed Academic References, Sensor ATBDs, and Indonesian National Standards.
 * Formatted in APA 7th Edition with official DOI / Regulation Number.
 */

const SCIENTIFIC_REFERENCES = {
  NDVI: {
    method_name: "Normalized Difference Vegetation Index (NDVI)",
    formula: "NDVI = (NIR - RED) / (NIR + RED)",
    spectral_requirements: {
      NIR: "Central wavelength 830-870 nm (Sentinel-2 Band 8, Landsat 8/9 Band 5)",
      RED: "Central wavelength 650-680 nm (Sentinel-2 Band 4, Landsat 8/9 Band 4)",
      correction_level: "Surface Reflectance (Bottom-of-Atmosphere, BOA Level-2A)",
    },
    primary_citations: [
      {
        author: "Rouse, J. W., Haas, R. H., Schell, J. A., & Deering, D. W.",
        year: 1974,
        title: "Monitoring vegetation systems in the Great Plains with ERTS",
        publication: "Third Earth Resources Technology Satellite-1 Symposium, NASA SP-351",
        pages: "309-317",
      },
      {
        author: "Tucker, C. J.",
        year: 1979,
        title: "Red and photographic infrared linear combinations for monitoring vegetation",
        publication: "Remote Sensing of Environment",
        volume: "8(2)",
        pages: "127-150",
        doi: "10.1016/0034-4257(79)90013-0",
      },
      {
        author: "Deering, D. W.",
        year: 1978,
        title: "Rangeland reflectance characteristics measured by photometer and polarimeter",
        publication: "PhD Dissertation, Texas A&M University",
      },
    ],
    thresholds_normative: {
      water_ice_snow: "< 0.0",
      bare_soil_rock: "0.0 - 0.2",
      sparse_vegetation: "0.2 - 0.4",
      moderate_vegetation: "0.4 - 0.6",
      dense_canopy_forest: "> 0.6",
    },
    assumptions: "Klorofil daun menyerap kuat radiasi gelombang merah (Red) untuk fotosintesis dan sel mesofil memantulkan kuat radiasi gelombang inframerah dekat (NIR).",
    limitations: "Mengalami saturasi (*saturation effect*) pada kanopi hutan tropis yang sangat lebat (LAI > 3) dan sensitif terhadap efek kecerahan tanah latar (*soil brightness*).",
  },

  NDBI: {
    method_name: "Normalized Difference Built-up Index (NDBI)",
    formula: "NDBI = (SWIR1 - NIR) / (SWIR1 + NIR)",
    spectral_requirements: {
      SWIR1: "Central wavelength 1550-1750 nm (Sentinel-2 Band 11, Landsat 8/9 Band 6)",
      NIR: "Central wavelength 830-870 nm (Sentinel-2 Band 8, Landsat 8/9 Band 5)",
      correction_level: "Surface Reflectance (BOA Level-2A)",
    },
    primary_citations: [
      {
        author: "Zha, Y., Gao, J., & Ni, S.",
        year: 2003,
        title: "Use of normalized difference built-up index in automatically mapping urban areas from TM imagery",
        publication: "International Journal of Remote Sensing",
        volume: "24(3)",
        pages: "583-594",
        doi: "10.1080/01431160304987",
      },
    ],
    thresholds_normative: {
      non_built_vegetation_water: "< 0.0",
      low_density_mixed: "0.0 - 0.1",
      moderate_built_up: "0.1 - 0.25",
      high_density_urban_impervious: "> 0.25",
    },
    assumptions: "Lahan terbangun dan struktur beraspal/beton memiliki reflektansi lebih tinggi pada panjang gelombang SWIR dibandingkan NIR.",
    limitations: "Dapat menghasilkan nilai tumpang tindih (*spectral confusion*) dengan lahan terbuka berpasir atau tanah gundul kering (*bare dry soil*).",
  },

  MNDWI: {
    method_name: "Modified Normalized Difference Water Index (MNDWI)",
    formula: "MNDWI = (GREEN - SWIR1) / (GREEN + SWIR1)",
    spectral_requirements: {
      GREEN: "Sentinel-2 Band 3, Landsat 8/9 Band 3",
      SWIR1: "Sentinel-2 Band 11, Landsat 8/9 Band 6",
    },
    primary_citations: [
      {
        author: "Xu, H.",
        year: 2006,
        title: "Modification of normalised difference water index (NDWI) to enhance open water features in remotely sensed imagery",
        publication: "International Journal of Remote Sensing",
        volume: "27(14)",
        pages: "3025-3033",
        doi: "10.1080/01431160600589179",
      },
    ],
    thresholds_normative: {
      land_vegetation: "< 0.0",
      saturated_wetland: "0.0 - 0.1",
      open_water_body: "> 0.1",
    },
    assumptions: "Air permukaan menyerap hampir seluruh gelombang SWIR dan memantulkan sebagian spektrum hijau.",
    limitations: "Bayangan awan tebal dan bayangan gedung tinggi (*building cast shadows*) dapat terdeteksi sebagai badan air palsu jika tidak di-masking.",
  },

  SLOPE: {
    method_name: "Analisis Kelerengan Morfometri Medan (Horn 3x3 Algorithm)",
    formula: "dz/dx = ((z3+2*z6+z9) - (z1+2*z4+z7)) / (8*cellRes); dz/dy = ((z7+2*z8+z9) - (z1+2*z2+z3)) / (8*cellRes); Slope = arctan(sqrt(dz_dx^2 + dz_dy^2))",
    primary_citations: [
      {
        author: "Horn, B. K.",
        year: 1981,
        title: "Hill shading and the reflectance map",
        publication: "Proceedings of the IEEE",
        volume: "69(1)",
        pages: "14-47",
        doi: "10.1109/PROC.1981.11918",
      },
    ],
    official_standards: [
      {
        regulation: "Peraturan Menteri Pekerjaan Umum No. 20/PRT/M/2007",
        title: "Pedoman Teknis Analisis Aspek Fisik & Lingkungan, Ekonomi serta Sosial Budaya dalam Penyusunan Rencana Tata Ruang",
        classes: [
          { class_name: "Datar", slope_percent: "0 - 8 %", slope_degree: "0 - 4.5°", color: "#1a9641", suitability: "Sangat Sesuai Permukiman & Pertanian Intensif" },
          { class_name: "Landai", slope_percent: "8 - 15 %", slope_degree: "4.5 - 8.5°", color: "#a6d96a", suitability: "Sesuai Permukiman dengan Konservasi Tanah Ringan" },
          { class_name: "Agak Curam", slope_percent: "15 - 25 %", slope_degree: "8.5 - 14.0°", color: "#ffffbf", suitability: "Penyangga, Hutan Produksi Terbatas" },
          { class_name: "Curam", slope_percent: "25 - 45 %", slope_degree: "14.0 - 24.2°", color: "#fdae61", suitability: "Kawasan Lindung, Rawan Erosi Tinggi" },
          { class_name: "Sangat Curam", slope_percent: "> 45 %", slope_degree: "> 24.2°", color: "#d7191c", suitability: "Mutlak Lindung, Sangat Rawan Longsor" },
        ],
      },
      {
        regulation: "Surat Keputusan Menteri Pertanian No. 837/KPTS/UM/11/1980",
        title: "Kriteria Penetapan Hutan Lindung",
      },
    ],
    assumptions: "Model elevasi menggunakan sistem koordinat planar metrik (UTM) dan rasio z-factor bernilai 1.0.",
    limitations: "Resolusi DEM 30m mengeneralisasi tebing mikro; tidak boleh digunakan untuk desain struktur pondasi teknik sipil mikro tanpa uji tanah lapangan.",
  },

  HYDROLOGY: {
    method_name: "Digital Elevation Model Hydrology (D8 Drainage & Stream Network)",
    formula: "Penyaluran arah aliran air ke salah satu dari 8 sel tetangga dengan penurunan ketinggian lereng tercuram (Steepest Descent).",
    primary_citations: [
      {
        author: "O'Callaghan, J. F., & Mark, D. M.",
        year: 1984,
        title: "The extraction of drainage networks from digital elevation data",
        publication: "Computer Vision, Graphics, and Image Processing",
        volume: "28(3)",
        pages: "323-344",
      },
      {
        author: "Tarboton, D. G.",
        year: 1997,
        title: "A new method for the determination of flow directions and upslope areas in grid digital elevation models",
        publication: "Water Resources Research",
        volume: "33(2)",
        pages: "309-319",
      },
      {
        author: "Strahler, A. N.",
        year: 1957,
        title: "Quantitative analysis of watershed geomorphology",
        publication: "Transactions, American Geophysical Union",
        volume: "38(6)",
        pages: "913-920",
      },
    ],
    assumptions: "Permukaan tanah tanpa depresi (*sink-free DEM*) dan arah aliran dikontrol murni oleh gaya gravitasi medan topografi.",
  },

  LST: {
    method_name: "Land Surface Temperature (LST) Split-Window / Radiative Transfer Equation",
    formula: "T_s = gamma * [1/epsilon * (psi_1 * L_sensor + psi_2) + psi_3] + delta",
    primary_citations: [
      {
        author: "Sobrino, J. A., Jimenez-Munoz, J. C., & Paolini, L.",
        year: 2004,
        title: "Land surface temperature retrieval from LANDSAT TM 5",
        publication: "Remote Sensing of Environment",
        volume: "90(4)",
        pages: "434-440",
      },
      {
        author: "Jimenez-Munoz, J. C., et al.",
        year: 2014,
        title: "Land surface temperature retrieval methods from Landsat-8 TIRS data",
        publication: "IEEE Geoscience and Remote Sensing Letters",
        volume: "11(10)",
        pages: "1840-1843",
      },
    ],
    sensor_requirements: "Wajib menggunakan data sensor Termal Inframerah (TIR): Landsat 8/9 TIRS Band 10 atau MODIS MOD11A1.",
    strict_policy: "HARAM dihitung dari kombinasi visual RGB atau Sentinel-2 murni tanpa saluran termal terkalibrasi.",
  },

  HAZARD: {
    method_name: "Multi-Criteria Disaster Risk Assessment (InaRISK Framework)",
    official_standards: [
      {
        regulation: "Peraturan Kepala BNPB No. 02 Tahun 2012",
        title: "Pedoman Umum Pengkajian Risiko Bencana",
        formula: "Risiko (R) = Bahaya (H) x Kerentanan (V) / Kapasitas (C)",
      },
    ],
    primary_citations: [
      {
        author: "Badan Nasional Penanggulangan Bencana (BNPB)",
        year: 2016,
        title: "InaRISK: Portal Kajian Risiko Bencana Indonesia Berbasis Spasial",
        publication: "Direktorat Pengurangan Risiko Bencana BNPB",
      },
    ],
  },
};

module.exports = {
  SCIENTIFIC_REFERENCES,
};
