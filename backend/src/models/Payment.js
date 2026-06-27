const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    invoiceId: { type: DataTypes.UUID, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    paymentDate: { type: DataTypes.DATEONLY, allowNull: false },
    method: { type: DataTypes.STRING, defaultValue: 'Bank Transfer' },
    reference: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
  }, {
    tableName: 'payments',
    timestamps: true,
  });
  return Payment;
};
