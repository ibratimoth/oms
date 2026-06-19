const { createClient } = require('redis');
const logger = require('../utils/logger'); 

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('connect', () => {
  logger.info('Redis client initiating connection...');
});

redisClient.on('ready', () => {
  logger.info('Redis client connected and ready to use.');
});

redisClient.on('error', (err) => {
  logger.error({ err }, 'Redis Client Error');
});

process.on('SIGINT', async () => {
  logger.info('Closing Redis connection...');
  await redisClient.quit();
});

module.exports = redisClient;