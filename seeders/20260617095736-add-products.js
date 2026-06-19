'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('products', [
      {
        name: 'USB Flash Drive 16GB',
        buy_price: 6000,
        sell_price: 10000,
        quantity_in_stock: 50,
        reorder_level: 10,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'USB Flash Drive 32GB',
        buy_price: 9000,
        sell_price: 15000,
        quantity_in_stock: 40,
        reorder_level: 10,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'USB Flash Drive 64GB',
        buy_price: 15000,
        sell_price: 22000,
        quantity_in_stock: 30,
        reorder_level: 8,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Android Fast Charger 18W',
        buy_price: 8000,
        sell_price: 15000,
        quantity_in_stock: 35,
        reorder_level: 10,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Type-C Fast Charger',
        buy_price: 10000,
        sell_price: 18000,
        quantity_in_stock: 25,
        reorder_level: 5,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Type-C Cable 1m',
        buy_price: 4000,
        sell_price: 8000,
        quantity_in_stock: 80,
        reorder_level: 15,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Lightning iPhone Cable',
        buy_price: 5000,
        sell_price: 10000,
        quantity_in_stock: 60,
        reorder_level: 15,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Extension Power Socket 3 Way',
        buy_price: 10000,
        sell_price: 18000,
        quantity_in_stock: 25,
        reorder_level: 5,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Power Bank 10000mAh',
        buy_price: 30000,
        sell_price: 50000,
        quantity_in_stock: 18,
        reorder_level: 5,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Bluetooth Mini Speaker',
        buy_price: 25000,
        sell_price: 40000,
        quantity_in_stock: 12,
        reorder_level: 3,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('products', null, {});
  }
};