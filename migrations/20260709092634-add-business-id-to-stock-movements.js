'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('stock_movements', 'business_id', {
      type: Sequelize.UUID, // Change to Sequelize.UUID if your business primary keys use UUIDs
      allowNull: true,         // Initially true to prevent errors if you already have existing data
      references: {
        model: 'Businesses',   // Name of the target table
        key: 'id'             // Target column in the businesses table
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'    // If a business profile is deleted, keep the movement logs but clear the mapping
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Crucial rollback rule: drop the column cleanly if we undo the migration
    await queryInterface.removeColumn('stock_movements', 'business_id');
  }
};