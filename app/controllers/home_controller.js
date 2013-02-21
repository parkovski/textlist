var locomotive = require('locomotive')
  , Controller = locomotive.Controller;

var HomeController = new Controller();

HomeController.main = function() {
  if (this.req.session.valid) {
    this.redirect('/command_center');
    return;
  }

  this.title = 'Text your cast!';
  this.render();
}

module.exports = HomeController;
