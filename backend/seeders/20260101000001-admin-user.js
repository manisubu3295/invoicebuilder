'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const passwordHash = await bcrypt.hash('Admin@AKB2026', 10);
    const adminId = uuidv4();
    const clientId = uuidv4();

    await queryInterface.bulkInsert('users', [{
      id: adminId,
      name: 'AK.BALAN',
      email: 'akbtransportlogistics@gmail.com',
      passwordHash,
      role: 'admin',
      phone: '+6584590123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    await queryInterface.bulkInsert('clients', [{
      id: clientId,
      companyName: 'Sri Murugan Manufacturing Pte. Ltd.',
      clientCode: 'SMM',
      contactPerson: 'Sri Murugan',
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
