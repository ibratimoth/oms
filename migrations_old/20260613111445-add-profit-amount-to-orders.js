'use strict';

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(
      'orders',
      'profit_amount',
      {
        type: Sequelize.DECIMAL(12,2),
        defaultValue: 0
      }
    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(
      'orders',
      'profit_amount'
    );

  }

};