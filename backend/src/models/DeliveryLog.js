const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('DeliveryLog', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false },
    categoryId: { type: DataTypes.UUID, allowNull: true },
    deliveredById: { type: DataTypes.UUID, allowNull: false },
    deliveryDate: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' }, // pending | invoiced
    notes: { type: DataTypes.TEXT },
  }, { tableName: 'delivery_logs', timestamps: true });
};
