const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('DeliveryItem', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    deliveryLogId: { type: DataTypes.UUID, allowNull: false },
    itemName: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 0 },
    unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    notes: { type: DataTypes.STRING },
  }, { tableName: 'delivery_items', timestamps: false });
};
