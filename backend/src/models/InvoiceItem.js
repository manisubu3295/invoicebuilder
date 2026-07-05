const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const InvoiceItem = sequelize.define('InvoiceItem', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    invoiceId: { type: DataTypes.UUID, allowNull: false },
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
    deliveryDates: { type: DataTypes.TEXT, allowNull: true },
    deliveryLogId: { type: DataTypes.UUID },
    deliveredBy: { type: DataTypes.STRING },
    runSheetNo: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: 'invoice_items',
    timestamps: false,
  });
  return InvoiceItem;
};
