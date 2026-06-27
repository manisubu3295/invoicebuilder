const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    plateNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    type: { type: DataTypes.STRING, allowNull: false }, // Lorry, Van, Truck
    size: { type: DataTypes.STRING }, // 10ft, 14ft, 24ft
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    notes: { type: DataTypes.TEXT },
  }, {
    tableName: 'vehicles',
    timestamps: true,
  });
  return Vehicle;
};
