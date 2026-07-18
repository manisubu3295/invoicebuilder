const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('CompanySettings', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    companyName: { type: DataTypes.STRING, defaultValue: 'My Transport Company' },
    registrationNo: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    website: { type: DataTypes.STRING, allowNull: true },
    bankName: { type: DataTypes.STRING, allowNull: true },
    bankAccountNo: { type: DataTypes.STRING, allowNull: true },
    bankAccountName: { type: DataTypes.STRING, allowNull: true },
    paynowNumber: { type: DataTypes.STRING, allowNull: true },
    currency: { type: DataTypes.STRING, defaultValue: 'SGD' },
    currencySymbol: { type: DataTypes.STRING, defaultValue: 'S$' },
    paymentTermsDays: { type: DataTypes.INTEGER, defaultValue: 30 },
    signatoryName: { type: DataTypes.STRING, allowNull: true },
    logoText: { type: DataTypes.STRING(10), allowNull: true },
    logoImage: { type: DataTypes.TEXT('long'), allowNull: true },
    sealImage: { type: DataTypes.TEXT('long'), allowNull: true },
    signatureImage: { type: DataTypes.TEXT('long'), allowNull: true },
    invoicePrefix: { type: DataTypes.STRING(20), defaultValue: 'INV' },
    invoiceStartNumber: { type: DataTypes.INTEGER, defaultValue: 1 },
    quotationPrefix: { type: DataTypes.STRING(20), defaultValue: 'QUO' },
    quotationStartNumber: { type: DataTypes.INTEGER, defaultValue: 1 },
    testModeEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { tableName: 'CompanySettings' });
};
