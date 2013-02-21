var locomotive = require('locomotive')
  , Controller = locomotive.Controller;

var LoginController = new Controller();

var easyGuesses = ['nachos', 'thelist', 'craigslist',
    'clark', 'clarkjewett'];

LoginController.authenticate = function() {
  var password = this.param('password');
  if (password == 'notyonachos') {
    this.req.session.valid = true;
    this.redirect('/command_center');
  } else if (easyGuesses.indexOf(password) >= 0) {
    this.redirect('/login/uhoh?nicetry');
  } else {
    this.redirect('/login/uhoh');
  }
}

LoginController.logout = function() {
  delete this.req.session.valid;
  this.redirect('/');
}

LoginController.uhoh = function() {
  this.title = 'Login failed';
  this.nicetry = this.param('nicetry');
  this.render();
}

module.exports = LoginController;
