var locomotive = require('locomotive')
  , Controller = locomotive.Controller
  , fs = require('fs')
  , pg = require('pg')
  , async = require('async');

var SetupController = new Controller();

SetupController.main = function() {
  var self = this;

  var settings;
  try {
    settings = require('../../config/settings');
  } catch (ex) {
  }

  this.getvar = function(v) {
    if (settings) {
      return ' value="' + settings[v] + '"';
    }
    return '';
  };

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

SetupController.createDatabases = function(settings) {
  var connStr = 'postgres://' + settings.dbuser + ':' +
    settings.dbpass + '@' + settings.dbhost + '/' + settings.dbname;

  var self = this;

  var dbs = ['people', 'groups', 'group_members'];
  var potentialCreateQueries = [
    'CREATE TABLE people (id serial primary key,' +
      ' firstname text, lastname text, phonenr text);',
    'CREATE TABLE groups (id serial primary key, name text);',
    'CREATE TABLE group_members (person_id integer references people(id),' +
      ' group_id integer references groups(id));'
  ];
  var createQueries = [];

  var checkIfDbsExist = function(err, client) {
    if (err) {
      self.redirect('/command_center/error?info=' + err);
    } else {
      var query = 'SELECT table_name FROM information_schema.tables' +
        ' WHERE table_schema = \'public\';';
      client.query(query, function(err, results) {
        if (err) {
          self.redirect('/command_center/error?info=' + err);
        } else {
          var dbsExist = true;
          for (var i = 0; i < dbs.length; ++i) {
            var dbExists = false;
            for (var j = 0; j < results.rows.length; ++j) {
              if (results.rows[j].table_name == dbs[i].name) {
                dbExists = true;
                break;
              }
            }
            if (!dbExists) {
              createQueries.push(potentialCreateQueries[i]);
              dbsExist = false;
            }
          }

          if (!dbsExist) {
            async.map(createQueries, function(item, callback) {
              client.query(item, callback);
            }, function(err, results) {
              if (err) {
                self.redirect('/command_center/error?info=' + err);
              } else {
                self.redirect('/command_center/?setup=true');
              }
            });
          } else {
            self.redirect('/command_center/?setup=true');
          }
        }
      });
    }
  };

  pg.connect(connStr, function(err, client, done) {
    checkIfDbsExist(err, client);
    if (done) {
      done();
    }
  });
};

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
    '  dbuser: \"' + dbuser + '\",\n' +
    '  dbpass: \"' + dbpass + '\",\n' +
    '  dbname: \"' + dbname + '\",\n' +
    '  twiliokey: \"' + twiliokey + '\",\n' +
    '  twiliosecret: \"' + twiliosecret + '\",\n' +
    '  twiliophone: \"' + twiliophone + '\"\n' +
    '};\n' +
    '\n' +
    'module.exports = settings;';

  fs.writeFile(__dirname + '/../../config/settings.js', content, function(err) {
    if (err) {
      self.redirect('/command_center?setup=false');
    } else {
      self.createDatabases({
        dbhost: dbhost,
        dbuser: dbuser,
        dbpass: dbpass,
        dbname: dbname
      });
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
