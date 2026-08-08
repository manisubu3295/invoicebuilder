'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const passwordHash = await bcrypt.hash('Admin@Demo2026', 10);
    const adminId = uuidv4();
    const clientId = uuidv4();

    await queryInterface.bulkInsert('users', [{
      id: adminId,
      name: 'Demo Admin',
      username: 'admin',
      email: 'admin@aadhirai.com',
      passwordHash,
      role: 'admin',
      phone: '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    await queryInterface.bulkInsert('clients', [{
      id: clientId,
      companyName: 'Sample Logistics Pte. Ltd.',
      clientCode: 'DEMO',
      contactPerson: 'Sample Contact',
      email: '',
      phone: '',
      address: 'Singapore',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('clients', null, {});
    await queryInterface.bulkDelete('users', null, {});
  },
};
