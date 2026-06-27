const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

const db = {};
db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.User = require('./User')(sequelize, Sequelize.DataTypes);
db.Client = require('./Client')(sequelize, Sequelize.DataTypes);
db.Vehicle = require('./Vehicle')(sequelize, Sequelize.DataTypes);
db.Driver = require('./Driver')(sequelize, Sequelize.DataTypes);
db.Job = require('./Job')(sequelize, Sequelize.DataTypes);
db.Quotation = require('./Quotation')(sequelize, Sequelize.DataTypes);
db.QuotationItem = require('./QuotationItem')(sequelize, Sequelize.DataTypes);
db.Invoice = require('./Invoice')(sequelize, Sequelize.DataTypes);
db.InvoiceItem = require('./InvoiceItem')(sequelize, Sequelize.DataTypes);
db.Payment = require('./Payment')(sequelize, Sequelize.DataTypes);
db.CompanySettings = require('./CompanySettings')(sequelize, Sequelize.DataTypes);
db.DeliveryLog = require('./DeliveryLog')(sequelize, Sequelize.DataTypes);
db.DeliveryItem = require('./DeliveryItem')(sequelize, Sequelize.DataTypes);
db.ItemCatalog = require('./ItemCatalog')(sequelize, Sequelize.DataTypes);

// Associations
db.Client.hasMany(db.Quotation, { foreignKey: 'clientId', as: 'quotations' });
db.Quotation.belongsTo(db.Client, { foreignKey: 'clientId', as: 'client' });

db.Quotation.hasMany(db.QuotationItem, { foreignKey: 'quotationId', as: 'items', onDelete: 'CASCADE' });
db.QuotationItem.belongsTo(db.Quotation, { foreignKey: 'quotationId' });

db.Client.hasMany(db.Invoice, { foreignKey: 'clientId', as: 'invoices' });
db.Invoice.belongsTo(db.Client, { foreignKey: 'clientId', as: 'client' });

db.Quotation.hasOne(db.Invoice, { foreignKey: 'quotationId', as: 'invoice' });
db.Invoice.belongsTo(db.Quotation, { foreignKey: 'quotationId', as: 'quotation' });

db.Invoice.hasMany(db.InvoiceItem, { foreignKey: 'invoiceId', as: 'items', onDelete: 'CASCADE' });
db.InvoiceItem.belongsTo(db.Invoice, { foreignKey: 'invoiceId' });

db.Invoice.hasMany(db.Payment, { foreignKey: 'invoiceId', as: 'payments', onDelete: 'CASCADE' });
db.Payment.belongsTo(db.Invoice, { foreignKey: 'invoiceId' });

db.Client.hasMany(db.Job, { foreignKey: 'clientId', as: 'jobs' });
db.Job.belongsTo(db.Client, { foreignKey: 'clientId', as: 'client' });

db.Vehicle.hasMany(db.Job, { foreignKey: 'vehicleId', as: 'jobs' });
db.Job.belongsTo(db.Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });

db.Driver.hasMany(db.Job, { foreignKey: 'driverId', as: 'jobs' });
db.Job.belongsTo(db.Driver, { foreignKey: 'driverId', as: 'driver' });

db.User.hasOne(db.Driver, { foreignKey: 'userId', as: 'driverProfile' });
db.Driver.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });

db.Vehicle.hasMany(db.Driver, { foreignKey: 'assignedVehicleId', as: 'drivers' });
db.Driver.belongsTo(db.Vehicle, { foreignKey: 'assignedVehicleId', as: 'assignedVehicle' });

db.Invoice.belongsTo(db.Job, { foreignKey: 'jobId', as: 'job' });
db.Job.hasOne(db.Invoice, { foreignKey: 'jobId', as: 'invoice' });

db.Client.hasMany(db.DeliveryLog, { foreignKey: 'clientId', as: 'deliveryLogs' });
db.DeliveryLog.belongsTo(db.Client, { foreignKey: 'clientId', as: 'client' });

db.User.hasMany(db.DeliveryLog, { foreignKey: 'deliveredById', as: 'deliveryLogs' });
db.DeliveryLog.belongsTo(db.User, { foreignKey: 'deliveredById', as: 'deliveredBy' });

db.DeliveryLog.hasMany(db.DeliveryItem, { foreignKey: 'deliveryLogId', as: 'items', onDelete: 'CASCADE' });
db.DeliveryItem.belongsTo(db.DeliveryLog, { foreignKey: 'deliveryLogId' });

module.exports = db;
