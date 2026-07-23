const { Op } = require('sequelize');

/**
 * Generates sequential daily order number (e.g., 260723-0001)
 * @param {Object} OrderModel - Your Sequelize Order model
 * @returns {Promise<string>}
 */
async function generateOrderNumber(OrderModel) {
  const now = new Date();

  // 1. Format Date to YYMMDD
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${yy}${mm}${dd}`;

  // 2. Define Start & End boundaries for today
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  // 3. Count existing records created today
  const todayOrderCount = await OrderModel.count({
    where: {
      createdAt: {
        [Op.between]: [startOfDay, endOfDay]
      }
    }
  });

  // 4. Pad sequential counter with leading zeros (e.g., 0001)
  const serialNumber = String(todayOrderCount + 1).padStart(4, '0');

  return `${datePrefix}-${serialNumber}`;
}

module.exports = { generateOrderNumber };