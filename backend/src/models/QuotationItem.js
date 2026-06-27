const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const QuotationItem = sequelize.define('QuotationItem', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    quotationId: { type: DataTypes.UUID, allowNull: false },
    sno: { type: DataTypes.INTEGER, allowNull: false },
    jobDescription: { type: DataTypes.TEXT, allowNull: false },
    vehicleSize: { type: DataTypes.STRING },
    fromDate: { type: DataTypes.DATEONLY },
    toDate: { type: DataTypes.DATEONLY },
    rate: { type: DataTypes.DECIMAL(10, 2) },
    rateType: { type: DataTypes.STRING, defaultValue: 'per_week' },
    totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    itemType: { type: DataTypes.STRING, defaultValue: 'service' }, // service | delivery
    quantity: { type: DataTypes.DECIMAL(10, 3) },
    unitPrice: { type: DataTypes.DECIMAL(10, 2) },
    deliveryDate: { type: DataTypes.DATEONLY },
  }, {
    tableName: 'quotation_items',
    timestamps: false,
  });
  return QuotationItem;
};
