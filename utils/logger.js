// logger.js
const pino = require('pino');
const path = require('path');

const transports = pino.transport({
  targets: [
    {
      target: 'pino-roll',
      options: {
        file: path.join(__dirname, '../logs/app'), 
        frequency: 'daily',
        dateFormat: 'yyyy-MM-dd', // Fixed property name and month casing                   
        size: '10m',                               
        mkdir: true,
      },
      level: 'info',
    },
    {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }
  ]
});

const logger = pino(transports);

module.exports = logger;