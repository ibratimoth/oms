const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    full_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('sales_officer', 'store_officer', 'admin'),
      defaultValue: 'sales_officer'
    }
  }, {
    tableName: 'Users',
    timestamps: true,
    underscored: true
  });

  return User;
};