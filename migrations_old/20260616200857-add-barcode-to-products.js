'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'barcode', {
      type: Sequelize.STRING,
      allowNull: true,         // Allows null initially so existing products don't break
      unique: true,            // Enforces that no two products share the same barcode
      after: 'name'            // Optional: Positions it nicely after the 'name' column (MySQL only, ignored by Postgres)
    });

    // Add an explicit index for lighting-fast database queries when scanning
    await queryInterface.addIndex('products', ['barcode']);
  },

  async down(queryInterface, Sequelize) {
    // Revert steps if you ever need to undo the migration
    await queryInterface.removeIndex('products', ['barcode']);
    await queryInterface.removeColumn('products', 'barcode');
  }
};