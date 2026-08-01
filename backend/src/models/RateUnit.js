const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('RateUnit', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    label: { type: DataTypes.STRING, allowNull: false },
    divisorDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, { tableName: 'rate_units', timestamps: true });
};
