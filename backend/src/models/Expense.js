const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define('Expense', {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    driverId: { type: DataTypes.UUID, allowNull: false },
    jobId: { type: DataTypes.UUID },
    vehicleId: { type: DataTypes.UUID },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    description: { type: DataTypes.TEXT },
    fuelLiters: { type: DataTypes.FLOAT },
    odometer: { type: DataTypes.INTEGER },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    adminNote: { type: DataTypes.TEXT },
    approvedById: { type: DataTypes.UUID },
    approvedAt: { type: DataTypes.DATE },
  }, {
    tableName: 'expenses',
    timestamps: true,
  });
  return Expense;
};
