const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define('Invoice', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    invoiceNo: { type: DataTypes.STRING, allowNull: false, unique: true },
    quotationId: { type: DataTypes.UUID },
    jobId: { type: DataTypes.UUID },
    clientId: { type: DataTypes.UUID, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    dueDate: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.STRING, defaultValue: 'draft' },
    totalAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    notes: { type: DataTypes.TEXT },
    pdfPath: { type: DataTypes.STRING },
    emailSentAt: { type: DataTypes.DATE },
    paidDate: { type: DataTypes.DATEONLY },
    invoiceType: { type: DataTypes.STRING, defaultValue: 'service' }, // service | delivery
    periodStart: { type: DataTypes.DATEONLY },
    periodEnd: { type: DataTypes.DATEONLY },
  }, {
    tableName: 'invoices',
    timestamps: true,
  });
  return Invoice;
};
