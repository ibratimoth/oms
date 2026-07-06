'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create the Businesses Table
    await queryInterface.createTable('Businesses', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // 2. Add business_id column to Users Table
    await queryInterface.addColumn('Users', 'business_id', {
      type: Sequelize.UUID,
      allowNull: true, // true initially so existing users don't break
      references: {
        model: 'Businesses',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 3. Add business_id column to Products Table
    await queryInterface.addColumn('products', 'business_id', {
      type: Sequelize.UUID,
      allowNull: true, // true initially to safely run on existing data
      references: {
        model: 'Businesses',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // 4. Add business_id column to Orders Table
    await queryInterface.addColumn('orders', 'business_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Businesses',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert everything in exact reverse order
    await queryInterface.removeColumn('Orders', 'business_id');
    await queryInterface.removeColumn('Products', 'business_id');
    await queryInterface.removeColumn('Users', 'business_id');
    await queryInterface.dropTable('Businesses');
  }
};