const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define('Driver', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    licenseNumber: { type: DataTypes.STRING },
    licenseExpiry: { type: DataTypes.DATEONLY },
    licenseClass: { type: DataTypes.STRING },
    nric: { type: DataTypes.STRING },
    emergencyContact: { type: DataTypes.STRING },
    emergencyPhone: { type: DataTypes.STRING },
    assignedVehicleId: { type: DataTypes.UUID },
    dailyRate: { type: DataTypes.DECIMAL(10, 2) },
  }, {
    tableName: 'drivers',
    timestamps: true,
  });
  return Driver;
};
