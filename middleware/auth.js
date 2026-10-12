// module.exports = function (req, res, next) {
//   if (!req.session.user) {
//     return res.redirect('/');
//   }
//   next();
// };

module.exports = function (req, res, next) {
  if (!req.session.user) {
    const returnTo = req.originalUrl;

    return res.redirect(`/?returnTo=${encodeURIComponent(returnTo)}`);
  }

  next();
};
