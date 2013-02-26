var locomotive = require('locomotive')
  , Controller = locomotive.Controller
  , pg = require('pg')
  , async = require('async');

var settings = null;
try {
  settings = require('../../config/settings');
} catch (ex) {
}

var pgClient = null;

// pass function(err, client)
function getPgConn(callback) {
  if (!settings) {
    callback('no settings present');
    return;
  }

  if (!pgClient) {
    var client = new pg.Client('tcp://' + settings.dbuser + ':' +
      settings.dbpass + '@' + settings.dbhost + '/' + settings.dbname);
    client.connect(function(err){
      callback(err, client);
    });
  } else {
    callback(null, pgClient);
  }
}

var CommandCenterController = new Controller();

CommandCenterController.main = function() {
  var setup = this.param('setup');

  if (settings == null) {
    this.redirect('/setup');
    return;
  }

  this.title = 'Command center';
  if (typeof setup != 'undefined') {
    if (setup == 'true') {
      this.title += ' (setup successful)';
    } else {
      this.redirect('/command_center/error?info=Setup failed');
    }
  }
  this.render();
}

CommandCenterController.error = function() {
  this.title = 'Error';
  this.info = this.param('info');
  this.render();
}

CommandCenterController.newText = function() {
  this.title = 'New text';
  this.type = 'text';
  this.jquery = true;
  this.render('new_message');
}

CommandCenterController.sendText = function() {
}

CommandCenterController.newCall = function() {
  this.title = 'New call';
  this.type = 'call';
  this.jquery = true;
  this.render('new_message');
}

CommandCenterController.sendCall = function() {
}

CommandCenterController.schedule = function() {
  this.title = 'Schedule';
  this.render();
}

CommandCenterController.newSchedule = function() {
  this.title = 'Schedule a call or text';
  this.render();
}

CommandCenterController.numbers = function() {
  var self = this;
  getPgConn(function(err, client) {
    if (err) {
      self.redirect('/command_center/error?info=' + err);
    } else {
      client.query('SELECT * FROM people;', function(err, result) {
        if (err) {
          self.redirect('/command_center/error?info=' + err);
        } else {
          self.title = 'Numbers';
          self.people = result.rows;
          self.render();
        }
      });
    }
  });
}

CommandCenterController.newNumber = function() {
  if (this.req.method.toUpperCase() == 'GET') {
    this.title = 'New number';
    this.render();
  } else { // POST
    var firstname = this.param('firstname');
    var lastname = this.param('lastname');
    var phonenr = this.param('phonenr');
    var self = this;
    if (!(firstname && lastname && phonenr)) {
      this.redirect('/command_center/numbers');
      return;
    }
    getPgConn(function(err, client) {
      if (err) {
        self.redirect('/command_center/error?info=' + err);
      } else {
        var query = 'INSERT INTO people (firstname, lastname, phonenr)' +
          ' VALUES ($1, $2, $3);';
        var values = [firstname, lastname, phonenr];
        client.query(query, values, function(err, result) {
          if (err) {
            self.redirect('/command_center/error?info=' + err);
          } else {
            self.redirect('/command_center/numbers');
          }
        });
      }
    });
  }
}

CommandCenterController.editNumber = function() {
  var self = this;
  var id = this.param('id');
  if (typeof id == 'undefined') {
    this.redirect('/command_center/error?info=no number id specified');
    return;
  }
  if (this.req.method.toUpperCase() == 'GET') {
    getPgConn(function(err, client) {
      if (err) {
        self.redirect('/command_center/error?info=' + err);
      } else {
        var query = 'SELECT * FROM people WHERE id=$1;';
        client.query(query, [id], function(err, result) {
          self.title = 'Edit number';
          self.id = id;
          self.firstname = result.rows[0].firstname;
          self.lastname = result.rows[0].lastname;
          self.phonenr = result.rows[0].phonenr;
          self.render();
        });
      }
    });
  } else { // POST
    var firstname = this.param('firstname');
    var lastname = this.param('lastname');
    var phonenr = this.param('phonenr');
    if (!(firstname && lastname && phonenr)) {
      self.redirect('/command_center/error?info=you left out some fields');
      return;
    }
    getPgConn(function(err, client) {
      if (err) {
        self.redirect('/command_center/error?info=' + err);
      } else {
        var query = 'UPDATE people SET firstname=$1, lastname=$2,' +
          ' phonenr=$3 WHERE id=$4;';
        var values = [firstname, lastname, phonenr, id];
        client.query(query, values, function(err, result) {
          if (err) {
            self.redirect('/command_center/error?info=' + err);
          } else {
            self.redirect('/command_center/numbers');
          }
        });
      }
    });
  }
}

CommandCenterController.deleteNumber = function() {
  if (this.req.method.toUpperCase() == 'GET') {
    this.title = 'Delete number';
    this.id = this.param('id');
    this.render();
  } else { // POST
    var id = this.param('id');
    var self = this;

    if (typeof id == 'undefined') {
      this.redirect('/command_center/numbers');
      return;
    }

    getPgConn(function(err, client) {
      if (err) {
        self.redirect('/command_center/error?info=' + err);
      } else {
        client.query('BEGIN;');
        client.query('DELETE FROM people WHERE id=$1;', [id]);
        client.query('DELETE FROM group_members WHERE person_id=$1;', [id]);
        client.query('COMMIT;', function(err, result) {
          if (err) {
            self.redirect('/command_center/error?info=' + err);
          } else {
            self.redirect('/command_center/numbers');
          }
        });
      }
    });
  }
}

CommandCenterController.groups = function() {
  var self = this;
  getPgConn(function(err, client) {
    if (err) {
      self.redirect('/command_center/error?info=' + err);
    } else {
      client.query('SELECT * FROM groups;', function(err, result) {
        if (err) {
          self.redirect('/command_center/error?info=' + err);
        } else {
          self.title = 'Groups';
          self.groups = result.rows;
          self.render();
        }
      });
    }
  });
}

CommandCenterController.newGroup = function() {
  if (this.req.method.toUpperCase() == 'GET') {
    this.title = 'New group';
    this.render();
  } else { // POST
    var name = this.param('name') || '';
    var self = this;
    if (name == '') {
      this.redirect('/command_center/error?info=need group name');
      return;
    }
    getPgConn(function(err, client) {
      if (err) {
        self.redirect('/command_center/error?info=' + err);
      } else {
        var query = 'INSERT INTO groups (name) VALUES ($1);';
        client.query(query, [name], function(err, result) {
          if (err) {
            self.redirect('/command_center/error?info=' + err);
          } else {
            self.redirect('/command_center/groups');
          }
        });
      }
    });
  }
}

CommandCenterController.editGroup = function() {
  var self = this;
  var id = this.param('id');
  if (typeof id == 'undefined') {
    this.redirect('/command_center/groups');
    return;
  }
  getPgConn(function(err, client) {
    if (err) {
      self.redirect('/command_center/error?info=' + err);
    } else {
      var q1 = 'SELECT name FROM groups WHERE id=$1;';
      var q2 = 'SELECT * FROM people LEFT OUTER JOIN' +
        ' group_members ON people.id = group_members.person_id' +
        ' AND group_members.group_id=$1;';
      async.map([q1, q2], function(item, callback) {
        client.query(item, [id], callback);
      }, function(err, results) {
        if (results[0] && results[0].rows.length == 0) {
          err = 'group ' + id + ' does not exist';
        }
        if (err) {
          self.redirect('/command_center/error?info=' + err);
        } else {
          var members = [];
          var nonmembers = [];
          for (var i = 0; i < results[1].rows.length; ++i) {
            if (results[1].rows[i].group_id === null) {
              nonmembers.push(results[1].rows[i]);
            } else {
              members.push(results[1].rows[i]);
            }
          }
          self.title = 'Group "' + results[0].rows[0].name + '"';
          self.id = id;
          self.members = members;
          self.nonmembers = nonmembers;
          self.render();
        }
      });
    }
  });
}

CommandCenterController.addToGroup = function() {
  var gid = this.param('gid');
  var uid = this.param('uid');
  var self = this;
  getPgConn(function(err, client) {
    if (err) {
      self.redirect('/command_center/error?info=' + err);
    } else {
      var query = 'INSERT INTO group_members (group_id, person_id)' +
        ' SELECT $1, $2 WHERE NOT EXISTS (SELECT NULL FROM group_members' +
        ' WHERE group_id=$1 AND person_id=$2);';
      client.query(query, [gid, uid], function(err, result) {
        if (err) {
          self.redirect('/command_center/error?info=' + err);
        } else {
          self.redirect('/command_center/groups/' + gid);
        }
      });
    }
  });
}

CommandCenterController.removeFromGroup = function() {
  var gid = this.param('gid');
  var uid = this.param('uid');
  var self = this;
  getPgConn(function(err, client) {
    if (err) {
      self.redirect('/command_center/error?info=' + err);
    } else {
      var query = 'DELETE FROM group_members WHERE group_id=$1' +
        ' AND person_id=$2;';
      client.query(query, [gid, uid], function(err, result) {
        if (err) {
          self.redirect('/command_center/error?info=' + err);
        } else {
          self.redirect('/command_center/groups/' + gid);
        }
      });
    }
  });
}

CommandCenterController.deleteGroup = function() {
  if (this.req.method.toUpperCase() == 'GET') {
    this.title = 'Delete group';
    this.id = this.param('id');
    this.render();
  } else { // POST
    var id = this.param('id');
    var self = this;

    if (typeof id == 'undefined') {
      this.redirect('/command_center/groups');
      return;
    }

    getPgConn(function(err, client) {
      if (err) {
        self.redirect('/command_center/error?info=' + err);
      } else {
        client.query('BEGIN;');
        client.query('DELETE FROM groups WHERE id=$1;', [id]);
        client.query('DELETE FROM group_members WHERE group_id=$1;', [id]);
        client.query('COMMIT;', function(err, result) {
          if (err) {
            self.redirect('/command_center/error?info=' + err);
          } else {
            self.redirect('/command_center/groups');
          }
        });
      }
    });
  }
}

// These kind of filters have to come after all the actions
// have been defined.
CommandCenterController.before('*', function(next) {
  //if (!this.req.session.valid) {
  //  this.redirect('/');
  //  return;
  //}

  this.sidebar = 'command_center/sidebar';
  next();
});

module.exports = CommandCenterController;
