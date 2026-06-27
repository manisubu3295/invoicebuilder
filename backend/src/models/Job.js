const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define('Job', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false },
    vehicleId: { type: DataTypes.UUID },
    driverId: { type: DataTypes.UUID },
    description: { type: DataTypes.TEXT, allowNull: false },
    fromDate: { type: DataTypes.DATEONLY, allowNull: false },
    toDate: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    notes: { type: DataTypes.TEXT },
    pickupLat: { type: DataTypes.FLOAT },
    pickupLng: { type: DataTypes.FLOAT },
    pickupAddress: { type: DataTypes.STRING(255) },
    deliveryLat: { type: DataTypes.FLOAT },
    deliveryLng: { type: DataTypes.FLOAT },
    deliveryAddress: { type: DataTypes.STRING(255) },
  }, {
    tableName: 'jobs',
    timestamps: true,
  });
  return Job;
};
