const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Quotation = sequelize.define('Quotation', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    quotationNo: { type: DataTypes.STRING, allowNull: false, unique: true },
    clientId: { type: DataTypes.UUID, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    validUntil: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.STRING, defaultValue: 'draft' },
    totalAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    notes: { type: DataTypes.TEXT },
  }, {
    tableName: 'quotations',
    timestamps: true,
  });
  return Quotation;
};
