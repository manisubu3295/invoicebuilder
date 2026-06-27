const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define('Driver', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    licenseNumber: { type: DataTypes.STRING },
    licenseExpiry: { type: DataTypes.DATEONLY },
    assignedVehicleId: { type: DataTypes.UUID },
  }, {
    tableName: 'drivers',
    timestamps: true,
  });
  return Driver;
};
