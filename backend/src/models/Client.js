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
  }, {
    tableName: 'clients',
    timestamps: true,
  });
  return Client;
};
