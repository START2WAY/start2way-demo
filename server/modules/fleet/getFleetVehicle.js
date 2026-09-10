const dal = require('../../dal');

function getFleetVehicle(companyId, vehicleId) {
  const row = dal.entities.getPayloadAndCompany('vehicles', vehicleId);
  if (!row) return null;
  if (row.company_id !== companyId) {
    return null; 
  }
  return JSON.parse(row.payload);
}

module.exports = getFleetVehicle;
