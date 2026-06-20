const Sentry = require("@sentry/node");

require('dotenv').config();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
const express = require('express');
const session = require('express-session');
const path = require('path');
const morgan = require('morgan');
const logger = require('./utils/logger');
const { RedisStore } = require('connect-redis');
const redisClient = require('./config/redis');
const flash = require('connect-flash');

const pinoHttp = require('pino-http')({
  logger,
  serializers: {
    req: () => undefined,
    res: () => undefined,
  },
  customProps: function (req, res) {
    return {
      responseTime: undefined 
    };
  },
  customSuccessMessage: function (req, res, responseTime) {
    return `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`;
  },
  customErrorMessage: function (req, res, err) {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
});

const app = express();

app.use(pinoHttp);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));

app.use(
  session({
    store: new RedisStore({ client: redisClient }), 
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 
    }
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.messages = {
    error: req.flash('error'),
    success: req.flash('success')
  };
  next();
});

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

app.use('/', require('./routes/authRoutes'));
app.use('/dashboard', require('./routes/dashboardRoutes'));
app.use('/products', require('./routes/productRoutes'));
app.use('/orders', require('./routes/orderRoutes'));
app.use('/analytics', require('./routes/analyticsRoutes'));
app.use('/stock', require('./routes/stockRoutes'));

Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
  req.log.error(err);
  res.status(500).send("Something broke!");
});

module.exports = app;