const { pool } = require('../db');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const listClusters = async ({ state, cropType }) => {
  const conditions = [];
  const params = [];
  if (state) { params.push(state); conditions.push(`state = $${params.length}`); }
  if (cropType) { params.push(cropType); conditions.push(`crop_type = $${params.length}`); }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM clusters ${whereClause} ORDER BY name ASC`, params);
  return result.rows;
};

const getClusterById = async (clusterId) => {
  const result = await pool.query(`SELECT * FROM clusters WHERE id = $1`, [clusterId]);
  if (result.rows.length === 0) {
    throw apiError(404, 'CLUSTER_NOT_FOUND', 'Cluster not found.');
  }
  return result.rows[0];
};

module.exports = { listClusters, getClusterById };
