const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define('Client', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    companyName: { type: DataTypes.STRING, allowNull: false },
    clientCode: { type: DataTypes.STRING(10), allowNull: true, unique: true },
    contactPerson: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING },
    address: { type: DataTypes.TEXT },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    invoicePrefix: { type: DataTypes.STRING(20), allowNull: true },
    invoiceStartNumber: { type: DataTypes.INTEGER, allowNull: true },
    quotationPrefix: { type: DataTypes.STRING(20), allowNull: true },
    quotationStartNumber: { type: DataTypes.INTEGER, allowNull: true },
    isTest: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    requiresRunSheet: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Default this client's invoices to the bulk run-sheet PDF layout
    bulkRunSheet: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Default this client's invoices to the item-matrix PDF layout
    itemMatrix: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'clients',
    timestamps: true,
  });
  return Client;
};
