'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      passwordHash: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.ENUM('admin', 'driver', 'staff'), defaultValue: 'staff' },
      phone: { type: Sequelize.STRING },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('clients', {
      id: { type: Sequelize.UUID, primaryKey: true },
      companyName: { type: Sequelize.STRING, allowNull: false },
      clientCode: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      contactPerson: { type: Sequelize.STRING },
      email: { type: Sequelize.STRING },
      phone: { type: Sequelize.STRING },
      address: { type: Sequelize.TEXT },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('vehicles', {
      id: { type: Sequelize.UUID, primaryKey: true },
      plateNumber: { type: Sequelize.STRING, allowNull: false, unique: true },
      type: { type: Sequelize.STRING, allowNull: false },
      size: { type: Sequelize.STRING },
      status: { type: Sequelize.ENUM('active', 'maintenance', 'retired'), defaultValue: 'active' },
      notes: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('drivers', {
      id: { type: Sequelize.UUID, primaryKey: true },
      userId: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      licenseNumber: { type: Sequelize.STRING },
      licenseExpiry: { type: Sequelize.DATEONLY },
      assignedVehicleId: { type: Sequelize.UUID, references: { model: 'vehicles', key: 'id' }, allowNull: true },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('jobs', {
      id: { type: Sequelize.UUID, primaryKey: true },
      clientId: { type: Sequelize.UUID, references: { model: 'clients', key: 'id' } },
      vehicleId: { type: Sequelize.UUID, references: { model: 'vehicles', key: 'id' }, allowNull: true },
      driverId: { type: Sequelize.UUID, references: { model: 'drivers', key: 'id' }, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: false },
      fromDate: { type: Sequelize.DATEONLY, allowNull: false },
      toDate: { type: Sequelize.DATEONLY, allowNull: false },
      status: { type: Sequelize.ENUM('pending', 'in_transit', 'delivered', 'cancelled'), defaultValue: 'pending' },
      notes: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('quotations', {
      id: { type: Sequelize.UUID, primaryKey: true },
      quotationNo: { type: Sequelize.STRING, allowNull: false, unique: true },
      clientId: { type: Sequelize.UUID, references: { model: 'clients', key: 'id' } },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      validUntil: { type: Sequelize.DATEONLY },
      status: { type: Sequelize.ENUM('draft', 'sent', 'accepted', 'rejected', 'converted'), defaultValue: 'draft' },
      totalAmount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('quotation_items', {
      id: { type: Sequelize.UUID, primaryKey: true },
      quotationId: { type: Sequelize.UUID, references: { model: 'quotations', key: 'id' }, onDelete: 'CASCADE' },
      sno: { type: Sequelize.INTEGER, allowNull: false },
      jobDescription: { type: Sequelize.TEXT, allowNull: false },
      vehicleSize: { type: Sequelize.STRING },
      fromDate: { type: Sequelize.DATEONLY },
      toDate: { type: Sequelize.DATEONLY },
      rate: { type: Sequelize.DECIMAL(10, 2) },
      rateType: { type: Sequelize.ENUM('per_day', 'per_week'), defaultValue: 'per_week' },
      totalAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    });

    await queryInterface.createTable('invoices', {
      id: { type: Sequelize.UUID, primaryKey: true },
      invoiceNo: { type: Sequelize.STRING, allowNull: false, unique: true },
      quotationId: { type: Sequelize.UUID, references: { model: 'quotations', key: 'id' }, allowNull: true },
      jobId: { type: Sequelize.UUID, references: { model: 'jobs', key: 'id' }, allowNull: true },
      clientId: { type: Sequelize.UUID, references: { model: 'clients', key: 'id' } },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      dueDate: { type: Sequelize.DATEONLY },
      status: { type: Sequelize.ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled'), defaultValue: 'draft' },
      totalAmount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      pdfPath: { type: Sequelize.STRING },
      emailSentAt: { type: Sequelize.DATE },
      paidDate: { type: Sequelize.DATEONLY },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('invoice_items', {
      id: { type: Sequelize.UUID, primaryKey: true },
      invoiceId: { type: Sequelize.UUID, references: { model: 'invoices', key: 'id' }, onDelete: 'CASCADE' },
      sno: { type: Sequelize.INTEGER, allowNull: false },
      jobDescription: { type: Sequelize.TEXT, allowNull: false },
      vehicleSize: { type: Sequelize.STRING },
      fromDate: { type: Sequelize.DATEONLY },
      toDate: { type: Sequelize.DATEONLY },
      rate: { type: Sequelize.DECIMAL(10, 2) },
      rateType: { type: Sequelize.ENUM('per_day', 'per_week'), defaultValue: 'per_week' },
      totalAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    });

    await queryInterface.createTable('payments', {
      id: { type: Sequelize.UUID, primaryKey: true },
      invoiceId: { type: Sequelize.UUID, references: { model: 'invoices', key: 'id' }, onDelete: 'CASCADE' },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      paymentDate: { type: Sequelize.DATEONLY, allowNull: false },
      method: { type: Sequelize.STRING, defaultValue: 'Bank Transfer' },
      reference: { type: Sequelize.STRING },
      notes: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE },
      updatedAt: { type: Sequelize.DATE },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('invoice_items');
    await queryInterface.dropTable('invoices');
    await queryInterface.dropTable('quotation_items');
    await queryInterface.dropTable('quotations');
    await queryInterface.dropTable('jobs');
    await queryInterface.dropTable('drivers');
    await queryInterface.dropTable('vehicles');
    await queryInterface.dropTable('clients');
    await queryInterface.dropTable('users');
  },
};
