'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Drop existing primary key on order_items
    try {
      await queryInterface.sequelize.query('ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_pkey" CASCADE;');
    } catch (e) {
      console.log('Pkey constraint bypass:', e.message);
    }

    // Helper to safely drop columns
    const safelyDropColumn = async (tableName, columnName) => {
      const tableDefinition = await queryInterface.describeTable(tableName);
      if (tableDefinition[columnName]) {
        await queryInterface.removeColumn(tableName, columnName);
        console.log(`Dropped column "${columnName}" from "${tableName}".`);
      }
    };

    // 2. Drop the old integer "id" column
    await safelyDropColumn('order_items', 'id');

    // 3. Re-add "id" as a fresh UUID Primary Key
    await queryInterface.addColumn('order_items', 'id', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
      primaryKey: true
    });
    console.log('Added UUID Primary Key "id" to "order_items".');
  },

  down: async (queryInterface, Sequelize) => {
    throw new Error('Rollback to integer IDs is not supported.');
  }
};