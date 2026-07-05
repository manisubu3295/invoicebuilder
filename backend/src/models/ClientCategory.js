const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('ClientCategory', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false },
    categoryId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: 'client_categories',
    timestamps: true,
    indexes: [{ unique: true, fields: ['clientId', 'categoryId'] }],
  });
};
