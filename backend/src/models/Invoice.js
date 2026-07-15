const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define('Invoice', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    invoiceNo: { type: DataTypes.STRING, allowNull: false, unique: true },
    quotationId: { type: DataTypes.UUID },
    jobId: { type: DataTypes.UUID },
    clientId: { type: DataTypes.UUID, allowNull: false },
    categoryId: { type: DataTypes.UUID, allowNull: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    dueDate: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.STRING, defaultValue: 'draft' },
    totalAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    notes: { type: DataTypes.TEXT },
    pdfPath: { type: DataTypes.STRING },
    emailSentAt: { type: DataTypes.DATE },
    paidDate: { type: DataTypes.DATEONLY },
    invoiceType: { type: DataTypes.STRING, defaultValue: 'service' }, // service | delivery
    // Render the PDF in bulk run-sheet format (Srl No | Date | Run Sheet |
    // Item | Count | Total, with a subtotal per run sheet)
    bulkRunSheet: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Render the PDF in item-matrix format (Srl No | Date | Run Sheet |
    // <one column per item> | Total, with a period total row). Takes
    // priority over bulkRunSheet if both are somehow set.
    itemMatrix: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Render the PDF in item-amount-matrix format (Srl No | Date | Run Sheet |
    // <Count + Amount columns per item, Amount = count x current Item Catalog
    // price> | Total, with a period totals row). Takes priority over both
    // itemMatrix and bulkRunSheet if more than one is somehow set.
    itemAmountMatrix: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    periodStart: { type: DataTypes.DATEONLY },
    periodEnd: { type: DataTypes.DATEONLY },
    isTest: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'invoices',
    timestamps: true,
  });
  return Invoice;
};
