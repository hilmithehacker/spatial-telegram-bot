/**
 * @file provenance_tracker.js
 * @description Provenance, Data Lineage & Reproducibility Tracking Engine.
 * Generates immutable provenance records for each spatial analysis.
 */

const crypto = require("crypto");

class ProvenanceTracker {
  /**
   * Initializes a new unique analysis execution record
   */
  static createRecord({
    toolId,
    toolName,
    datasetId,
    datasetCatalogMeta,
    aoiQuery,
    bbox,
    utmZone,
    userParameters = {},
  }) {
    const timestampIso = new Date().toISOString();
    const rawIdString = `${toolId}_${aoiQuery}_${timestampIso}_${JSON.stringify(bbox)}`;
    const analysisId = "SYN-" + crypto.createHash("sha256").update(rawIdString).digest("hex").slice(0, 12);

    return {
      analysis_id: analysisId,
      tool_id: toolId,
      tool_name: toolName,
      dataset_id: datasetId,
      official_product_name: datasetCatalogMeta?.name || "Official Geospatial Product",
      provider: datasetCatalogMeta?.provider || "Authoritative Provider",
      created_at: timestampIso,
      scientific_strict_mode: true,
      data_lineage_steps: [
        {
          step: 1,
          name: "AOI_SPECIFICATION",
          timestamp: timestampIso,
          details: { query: aoiQuery, bbox: bbox, calculated_utm: utmZone },
        },
      ],
      spatial_context: {
        bbox: bbox,
        geographic_crs: "EPSG:4326 (WGS 84)",
        projected_crs: utmZone?.epsg || "EPSG:3857",
        utm_zone_name: utmZone?.name || "UTM Local",
      },
      quality_gate_checks: [],
      validation_status: "INITIALIZING",
      reproducibility: {
        hash: null,
        parameters: userParameters,
        software: {
          engine: "UrbanTech SpatialEngine Core (Scientific Refactored)",
          version: "6.0.0-academic",
          node_runtime: process.version,
        },
      },
      limitations: [],
      citations: [],
    };
  }

  /**
   * Records a data acquisition event with complete provider trace
   */
  static recordAcquisition(record, { sourceUrl, providerEndpoint, status, httpCode, metadata }) {
    record.data_lineage_steps.push({
      step: 2,
      name: "DATA_ACQUISITION",
      timestamp: new Date().toISOString(),
      source_url: sourceUrl,
      provider_endpoint: providerEndpoint,
      status: status,
      http_status_code: httpCode,
      remote_metadata: metadata || null,
    });
  }

  /**
   * Records Quality Gate validation result
   */
  static recordQualityGate(record, gateName, passed, reason, metrics = {}) {
    record.quality_gate_checks.push({
      gate: gateName,
      passed: passed,
      timestamp: new Date().toISOString(),
      reason: reason,
      metrics: metrics,
    });
  }

  /**
   * Finalizes the record with hash signature
   */
  static finalizeRecord(record, resultMetadata) {
    record.data_lineage_steps.push({
      step: record.data_lineage_steps.length + 1,
      name: "ANALYSIS_COMPLETION",
      timestamp: new Date().toISOString(),
      result: resultMetadata,
    });

    const serialized = JSON.stringify(record);
    record.reproducibility.hash = crypto.createHash("sha256").update(serialized).digest("hex");
    return record;
  }
}

module.exports = {
  ProvenanceTracker,
};
