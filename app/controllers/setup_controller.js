var locomotive = require('locomotive')
  , Controller = locomotive.Controller
  , fs = require('fs');

var SetupController = new Controller();

SetupController.main = function() {
  var self = this;

  if (typeof this.param('sure') != 'undefined') {
    this.title = 'Setup';
    this.render();
    return;
  }

  fs.exists(__dirname + '/../../config/settings.js', function(exists) {
    if (exists) {
      self.redirect('/setup/confirm');
    } else {
      self.title = 'Setup';
      self.render();
    }
  });
}

SetupController.confirm = function() {
  this.title = 'Confirm setup';
  this.render();
}

SetupController.finish = function() {
  var dbhost = this.param('dbhost');
  var dbuser = this.param('dbuser');
  var dbpass = this.param('dbpass');
  var dbname = this.param('dbname');
  var twiliokey = this.param('twiliokey');
  var twiliosecret = this.param('twiliosecret');
  var twiliophone = this.param('twiliophone');

  if (!(dbhost && dbuser && dbpass && dbname &&
        twiliokey && twiliosecret && twiliophone)) {
    this.redirect('/setup?sure');
    return;
  }

  var self = this;
  var content = 'var settings = {\n' +
    '  dbhost: \"' + dbhost + '\",\n' +
    '  dbname: \"' + dbname + '\",\n' +
    '  dbpass: \"' + dbpass + '\",\n' +
    '  dbname: \"' + dbname + '\",\n' +
    '  twiliokey: \"' + twiliokey + '\",\n' +
    '  twiliosecret: \"' + twiliosecret + '\",\n' +
    '  twiliophone: \"' + twiliophone + '\"\n' +
    '};\n' +
    '\n' +
    'module.exports = settings;';

  fs.writeFile('../../config/settings.js', content, function(err) {
    if (err) {
      self.redirect('/command_center?setup=false');
    } else {
      self.redirect('/command_center?setup=true');
    }
  });
}

SetupController.before('*', function(next) {
  var self = this;
  fs.exists('../../config/settings.js', function(exists) {
    if (!exists || self.req.session.valid) {
      next();
    } else {
      self.redirect('/');
    }
  });
});

module.exports = SetupController;
