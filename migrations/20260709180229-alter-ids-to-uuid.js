'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. DROP ALL CONFLICTING CONSTRAINTS TO UNLOCK THE TABLES
    try {
      await queryInterface.sequelize.query('ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_order_id_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_created_by_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_user_id_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_business_id_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_product_id_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_business_id_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_fkey";');
    } catch (e) {
      console.log('Constraint cleanup step bypassed:', e.message);
    }

    // Helper function to safely drop columns only if they exist
    const safelyDropColumn = async (tableName, columnName) => {
      const tableDefinition = await queryInterface.describeTable(tableName);
      if (tableDefinition[columnName]) {
        await queryInterface.removeColumn(tableName, columnName);
        console.log(`Successfully removed column "${columnName}" from table "${tableName}".`);
      } else {
        console.log(`Column "${columnName}" on table "${tableName}" does not exist. Skipping drop step.`);
      }
    };

    // Helper function to safely add columns with PostgreSQL-native UUID generation
    const safelyAddColumn = async (tableName, columnName) => {
      const tableDefinition = await queryInterface.describeTable(tableName);
      if (!tableDefinition[columnName]) {
        await queryInterface.addColumn(tableName, columnName, {
          type: Sequelize.UUID,
          // gen_random_uuid() is built-in to modern PostgreSQL (13+) 
          // and automatically populates existing rows with fresh UUIDs
          defaultValue: Sequelize.literal('gen_random_uuid()'),
          allowNull: false,
          primaryKey: true
        });
        console.log(`Successfully added UUID column "${columnName}" to table "${tableName}".`);
      } else {
        console.log(`Column "${columnName}" already exists on table "${tableName}". Skipping add step.`);
      }
    };

    // 2. DROP THE OLD INTEGER ID COLUMNS SAFELY
    await safelyDropColumn('Users', 'id'); 
    await safelyDropColumn('products', 'id');
    await safelyDropColumn('orders', 'id');
    await safelyDropColumn('stock_movements', 'id');

    // 3. ADD THEM BACK FRESH AS UUID COLUMNS SAFELY (using Postgres-native UUID generator)
    await safelyAddColumn('Users', 'id');
    await safelyAddColumn('products', 'id');
    await safelyAddColumn('orders', 'id');
    await safelyAddColumn('stock_movements', 'id');
  },

  down: async (queryInterface, Sequelize) => {
    throw new Error('Rollback from UUID to auto-incrementing integer is not supported.');
  }
};