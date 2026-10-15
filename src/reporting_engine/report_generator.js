/**
 * @file report_generator.js
 * @description Academic Narrative & Spatial Report Generation Engine.
 * Explicitly separates Empirical Observations, Analysis Results, Indicative Interpretation, and Limitations.
 */

class ReportGenerator {
  /**
   * Generates a fully formatted scientific report for Telegram
   */
  static generateAcademicReport({
    provenanceRecord,
    datasetMeta,
    zonalStats = [],
    validationResult,
    uncertaintyProfile,
    scientificReference,
  }) {
    let text = `📄 <b>LAPORAN ANALISIS GEOSPASIAL TERVALIDASI</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🆔 <b>Analysis ID:</b> <code>${provenanceRecord.analysis_id}</code>\n`;
    text += `🛰️ <b>Instrumen/Metode:</b> <b>${provenanceRecord.tool_name}</b>\n`;
    text += `📦 <b>Produk Resmi:</b> <code>${provenanceRecord.official_product_name}</code>\n`;
    text += `🏛️ <b>Penyedia Data:</b> <code>${provenanceRecord.provider}</code>\n`;
    text += `🗺️ <b>Wilayah Studi:</b> <b>${provenanceRecord.spatial_context?.bbox?.name || "AOI Terdefinisi"}</b>\n`;
    text += `📐 <b>CRS Analisis:</b> <code>${provenanceRecord.spatial_context?.projected_crs}</code> (${provenanceRecord.spatial_context?.utm_zone_name})\n`;
    text += `⏱️ <b>Waktu Proses:</b> <code>${provenanceRecord.created_at}</code>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 1. Matriks Hasil Analisis
    if (zonalStats && zonalStats.length > 0) {
      text += `📊 <b>I. MATRIKS DISTRIBUSI SPASIAL (HASIL ANALISIS):</b>\n`;
      zonalStats.forEach((st) => {
        text += `  • ${st.className}: <b>${st.percentage}%</b> (${st.areaHa.toLocaleString("id-ID")} ha)\n`;
      });
      text += `\n`;
    }

    // 2. Status Validasi & Uncertainty
    text += `⚖️ <b>II. STATUS VALIDASI & KETIDAKPASTIAN:</b>\n`;
    text += `  • <b>Status:</b> <code>${validationResult?.status || "NOT_VALIDATED"}</code>\n`;
    text += `  • <b>Keterangan:</b> <i>${validationResult?.summary || "-"}</i>\n`;
    if (uncertaintyProfile) {
      if (uncertaintyProfile.spatialUncertainty) text += `  • <i>${uncertaintyProfile.spatialUncertainty}</i>\n`;
      if (uncertaintyProfile.verticalUncertainty) text += `  • <i>${uncertaintyProfile.verticalUncertainty}</i>\n`;
    }
    text += `\n`;

    // 3. Batasan Analisis & Disclaimer Akademik
    text += `⚠️ <b>III. BATASAN & KETENTUAN HUKUM:</b>\n`;
    text += `  • Hasil pemetaan berskala makro/meso ini bersifat <b>indikatif ilmiah</b>.\n`;
    text += `  • Analisis ini tidak menggantikan pengukuran kadastral terestrial BPN atau penyelidikan geoteknik lapangan.\n\n`;

    // 4. Dasar Regulasi / Sitasi
    if (scientificReference) {
      text += `📚 <b>IV. DASAR REGULASI & REFERENSI ILMIAH:</b>\n`;
      if (scientificReference.official_standards) {
        scientificReference.official_standards.forEach((reg) => {
          text += `  • <b>${reg.regulation}</b>: <i>${reg.title}</i>\n`;
        });
      }
      if (scientificReference.primary_citations && scientificReference.primary_citations.length > 0) {
        const c = scientificReference.primary_citations[0];
        text += `  • Sitasi: ${c.author} (${c.year}). <i>${c.title}</i>. ${c.publication}.\n`;
      }
    }

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🔒 <i>SHA-256 Provenance Hash: <code>${provenanceRecord.reproducibility?.hash?.slice(0, 16) || "PENDING"}...</code></i>`;

    return text;
  }

  /**
   * Generates a transparent "ANALYSIS BLOCKED" message
   */
  static generateBlockedReport({ toolName, reason, requiredInputs, availableInputs }) {
    let text = `🛑 <b>ANALISIS DIBLOKIR (SCIENTIFIC QUALITY GATE)</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⚙️ <b>Fitur:</b> ${toolName}\n`;
    text += `❌ <b>Alasan Pemblokiran:</b>\n<b>${reason}</b>\n\n`;
    text += `📋 <b>Prasyarat Data Fisik:</b>\n<code>${requiredInputs.join(", ")}</code>\n\n`;
    text += `📦 <b>Data yang Tersedia:</b>\n<code>${availableInputs.join(", ") || "Tidak Ada"}</code>\n\n`;
    text += `💡 <b>Kebijakan Integritas Ilmiah Urban-Tech:</b>\n`;
    text += `<i>"Ketiadaan data observasi riil TIDAK PERNAH digantikan dengan data sintetis atau estimasi buatan."</i>\n`;
    text += `Sistem memilih membatalkan analisis daripada menyajikan kesimpulan yang keliru.`;

    return text;
  }
}

module.exports = {
  ReportGenerator,
};
