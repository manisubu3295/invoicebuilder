const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('ItemCatalog', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    unit: { type: DataTypes.STRING, defaultValue: '' },
    unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, { tableName: 'item_catalog', timestamps: true });
};
