/**
 * @file geoportal_engine.js
 * @description Authentic Indonesian National Geoportal WMS / ArcGIS REST Connector.
 * Direct connections to BIG, BNPB InaRISK, ATR/BPN GISTARU, ESDM, and KLHK.
 * STRICT REFACTOR: Removed mock OpenStreetMap tile injection pretending to be RBI BIG.
 */

const GEOPORTAL_SERVICES = {
  // 1. Badan Informasi Geospasial (BIG)
  rbi_big: {
    id: "rbi_big",
    name: "Peta Rupabumi Indonesia (RBI 1:25.000 / 1:50.000)",
    authority: "Badan Informasi Geospasial (BIG) Republik Indonesia",
    type: "ArcGIS REST / WMS MapServer Resmi",
    url: "https://geoservices.big.go.id/rbi/rest/services/RBI/Peta_Rupabumi_Indonesia/MapServer",
    wmsEndpoint: "https://geoservices.big.go.id/rbi/services/RBI/Peta_Rupabumi_Indonesia/MapServer/WMSServer",
    qgisSnippet: (layerName = "Peta RBI Nasional (BIG)") => `
# Injeksi WMS Resmi Badan Informasi Geospasial (BIG)
from qgis.core import QgsRasterLayer, QgsProject
from qgis.utils import iface

wms_url = "crs=EPSG:4326&dpiMode=7&format=image/png&layers=0&styles=&url=https://geoservices.big.go.id/rbi/services/RBI/Peta_Rupabumi_Indonesia/MapServer/WMSServer"
rbi_layer = QgsRasterLayer(wms_url, '${layerName}', 'wms')
if rbi_layer.isValid():
    QgsProject.instance().addMapLayer(rbi_layer)
    iface.setActiveLayer(rbi_layer)
    iface.mapCanvas().refresh()
    print("SUCCESS: Layer WMS RBI BIG Resmi Berhasil Dimuat.")
else:
    print("WARNING: Layanan WMS BIG sedang sibuk/offline. Data otentik tidak digantikan.")
`,
    desc: "Peta dasar topografi resmi nasional memuat kontur, hidrografi, toponim, batas administrasi, dan toponim (SNI 6502.2:2010).",
  },

  // 2. GISTARU ATR/BPN (Pola Ruang RTRW & RDTR)
  gistaru_atr: {
    id: "gistaru_atr",
    name: "Pola Ruang RTRW & RDTR Nasional (GISTARU)",
    authority: "Kementerian Agraria dan Tata Ruang / Badan Pertanahan Nasional (ATR/BPN)",
    type: "ArcGIS REST / WMS",
    url: "https://gistaru.atrbpn.go.id/arcgis/rest/services",
    qgisSnippet: (layerName = "Pola Ruang RTRW (GISTARU ATR/BPN)") => `
from qgis.core import QgsRasterLayer, QgsProject
from qgis.utils import iface

wms_url = "crs=EPSG:4326&dpiMode=7&format=image/png&layers=0&styles=&url=https://gistaru.atrbpn.go.id/arcgis/services/POLA_RUANG_RTRW/MapServer/WMSServer"
layer = QgsRasterLayer(wms_url, '${layerName}', 'wms')
if layer.isValid():
    QgsProject.instance().addMapLayer(layer)
    iface.mapCanvas().refresh()
    print("SUCCESS: Layer GISTARU ATR/BPN Resmi Terhubung.")
else:
    print("INFO: Endpoint GISTARU memerlukan sesi jaringan internal kementerian.")
`,
    desc: "Peta zonasi tata ruang resmi (RTRW Provinsi/Kabupaten & RDTR) untuk verifikasi izin pemanfaatan ruang (KKPR).",
  },

  // 3. InaRISK BNPB (Multi-Bencana Nasional)
  inarisk_bnpb: {
    id: "inarisk_bnpb",
    name: "InaRISK Peta Bahaya Bencana Nasional",
    authority: "Badan Nasional Penanggulangan Bencana (BNPB)",
    type: "ArcGIS REST MapServer",
    url: "https://inarisk.bnpb.go.id/arcgis/rest/services/layer_dasar/MapServer",
    qgisSnippet: (layerName = "InaRISK BNPB - Bahaya Bencana") => `
from qgis.core import QgsRasterLayer, QgsProject
from qgis.utils import iface

wms_url = "crs=EPSG:4326&dpiMode=7&format=image/png&layers=0&styles=&url=https://inarisk.bnpb.go.id/arcgis/services/layer_dasar/MapServer/WMSServer"
layer = QgsRasterLayer(wms_url, '${layerName}', 'wms')
if layer.isValid():
    QgsProject.instance().addMapLayer(layer)
    iface.mapCanvas().refresh()
    print("SUCCESS: Layer InaRISK BNPB Resmi Terhubung.")
else:
    print("WARNING: Layanan InaRISK BNPB sedang mengalami traffic padat.")
`,
    desc: "Layer resmi indeks bahaya banjir, longsor, tsunami, gempa, dan letusan gunungapi se-Indonesia (Perka BNPB No. 2/2012).",
  },

  // 4. ESDM OneMap (Geologi & Vulkanik)
  esdm_geologi: {
    id: "esdm_geologi",
    name: "Peta Geologi Regional & Bahaya Gunungapi",
    authority: "Badan Geologi - Kementerian ESDM",
    type: "ArcGIS REST / WMS",
    url: "https://geoportal.esdm.go.id/geologi/rest/services",
    qgisSnippet: (layerName = "Peta Geologi Regional (ESDM)") => `
from qgis.core import QgsRasterLayer, QgsProject
from qgis.utils import iface

wms_url = "crs=EPSG:4326&dpiMode=7&format=image/png&layers=0&styles=&url=https://geoportal.esdm.go.id/geologi/services/Peta_Geologi/MapServer/WMSServer"
layer = QgsRasterLayer(wms_url, '${layerName}', 'wms')
if layer.isValid():
    QgsProject.instance().addMapLayer(layer)
    iface.mapCanvas().refresh()
    print("SUCCESS: Layer Geologi ESDM Resmi Terhubung.")
`,
    desc: "Formasi batuan regional, sesar aktif/patahan gempa, dan Kawasan Rawan Bencana Gunungapi (KRB).",
  },

  // 5. KLHK (Kawasan Hutan)
  klhk_hutan: {
    id: "klhk_hutan",
    name: "Peta Kawasan Hutan & Konservasi",
    authority: "Kementerian Lingkungan Hidup dan Kehutanan (KLHK)",
    type: "Web Map Service (WMS)",
    url: "https://geoportal.menlhk.go.id/arcgis/rest/services",
    qgisSnippet: (layerName = "Kawasan Hutan (KLHK)") => `
from qgis.core import QgsRasterLayer, QgsProject
from qgis.utils import iface

wms_url = "crs=EPSG:4326&dpiMode=7&format=image/png&layers=0&styles=&url=https://geoportal.menlhk.go.id/arcgis/services/Kawasan_Hutan/MapServer/WMSServer"
layer = QgsRasterLayer(wms_url, '${layerName}', 'wms')
if layer.isValid():
    QgsProject.instance().addMapLayer(layer)
    iface.mapCanvas().refresh()
    print("SUCCESS: Layer Kawasan Hutan KLHK Resmi Terhubung.")
`,
    desc: "Penetapan status kawasan hutan (Hutan Lindung, Hutan Produksi, Konservasi, Areal Penggunaan Lain).",
  },
};

module.exports = {
  GEOPORTAL_SERVICES,
};
