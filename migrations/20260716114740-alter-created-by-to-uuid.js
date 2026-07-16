'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. DROP ALL POSSIBLE CONSTRAINTS (To avoid foreign key conflicts)
    try {
      await queryInterface.sequelize.query('ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_created_by_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_user_id_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_created_by_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_user_id_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_created_by_fkey";');
    } catch (e) {
      console.log('Constraint cleanup bypassed:', e.message);
    }

    // Helper to safely drop a column only if it exists
    const safelyDropColumn = async (tableName, columnName) => {
      const tableDefinition = await queryInterface.describeTable(tableName);
      if (tableDefinition[columnName]) {
        await queryInterface.removeColumn(tableName, columnName);
        console.log(`Dropped column "${columnName}" from "${tableName}".`);
      }
    };

    // 2. CLEAN THE SLATE (Drop both old user_id and created_by columns)
    await safelyDropColumn('products', 'created_by');
    
    await safelyDropColumn('orders', 'user_id');
    await safelyDropColumn('orders', 'created_by');

    await safelyDropColumn('stock_movements', 'user_id');
    await safelyDropColumn('stock_movements', 'created_by');

    // 3. ENSURE "Users" Table has the Primary Key constraint set
    try {
      await queryInterface.sequelize.query('ALTER TABLE "Users" ADD CONSTRAINT "Users_pkey" PRIMARY KEY ("id");');
      console.log('Established primary key constraint on Users table.');
    } catch (e) {
      console.log('Users primary key already exists, skipping.');
    }

    // 4. ADD "created_by" TO ALL TABLES FRESH AS UUIDs
    const fkeySchema = {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    };

    await queryInterface.addColumn('products', 'created_by', fkeySchema);
    console.log('Added UUID column "created_by" to "products".');

    await queryInterface.addColumn('orders', 'created_by', fkeySchema);
    console.log('Added UUID column "created_by" to "orders".');

    await queryInterface.addColumn('stock_movements', 'created_by', fkeySchema);
    console.log('Added UUID column "created_by" to "stock_movements".');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert step: Safely drop the newly created "created_by" columns
    await queryInterface.removeColumn('products', 'created_by');
    await queryInterface.removeColumn('orders', 'created_by');
    await queryInterface.removeColumn('stock_movements', 'created_by');
    console.log('Successfully rolled back all created_by UUID columns.');
  }
};