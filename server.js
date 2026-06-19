const app = require('./app');
const sequelize = require('./config/database');
const logger = require('./utils/logger');
const redisClient = require('./config/redis');

const PORT = process.env.PORT || 3000;

(async () => {
  try {

    await redisClient.connect();

    await sequelize.authenticate();
    logger.info('Database connected');

    await sequelize.sync(); 

    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.fatal('Error:', err);
  }
})();