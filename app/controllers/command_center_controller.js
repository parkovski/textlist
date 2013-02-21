var locomotive = require('locomotive')
  , Controller = locomotive.Controller
  , pg = require('pg');

var settings = null;
try {
  settings = require('../../config/settings');
} catch (ex) {
}

// pass function(err, client)
function getPgConn(callback) {
  if (!settings) {
    callback('no settings present');
    return;
  }

  var client = new pg.Client('tcp://' + settings.dbuser + ':' +
    settings.dbpass + '@' + settings.dbhost + '/' + settings.dbname);
  client.connect(function(err){
    callback(err, client);
  });
};

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
  this.render('new_message');
}

CommandCenterController.sendText = function() {
}

CommandCenterController.newCall = function() {
  this.title = 'New call';
  this.type = 'call';
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
        client.query('INSERT INTO people (firstname, lastname, phonenr) VALUES ($1, $2, $3);',
          [firstname, lastname, phonenr], function(err, result) {
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

// TODO: delete from associations
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
        client.query('DELETE FROM people WHERE id=$1;', [id],
          function(err, result) {
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
        client.query('INSERT INTO groups (name) VALUES ($1);', [name],
          function(err, result) {
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
      client.query('SELECT name FROM groups WHERE id=$1', [id],
        function(err, grpresult) {
          if (grpresult && grpresult.rows.length == 0) {
            err = 'group ' + id + ' does not exist';
          }
          if (err) {
            self.redirect('/command_center/error?info=' + err);
          } else {
            client.query('SELECT * FROM people;', function(err, result) {
              if (err) {
                self.redirect('/command_center/error?info=' + err);
              } else {
                client.query('SELECT * FROM group_members;',
                  function(err, result2) {
                    if (err) {
                      self.redirect('/command_center/error?info=' + err);
                    } else {
                      var members = [];
                      var nonmembers = [];
                      var uidsInGroup = {};
                      for (var i = 0; i < result2.rows.length; ++i) {
                        if (result2.rows[i].group_id == id) {
                          uidsInGroup[result2.rows[i].person_id] = true;
                        }
                      }
                      for (i = 0; i < result.rows.length; ++i) {
                        if (uidsInGroup.hasOwnProperty(result.rows[i].id)) {
                          members.push(result.rows[i]);
                        } else {
                          nonmembers.push(result.rows[i]);
                        }
                      }
                      self.title = 'View/edit group "' +
                        grpresult.rows[0].name + '"';
                      self.id = id;
                      self.members = members;
                      self.nonmembers = nonmembers;
                      self.render();
                    }
                  });
              }
            });
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
      client.query('INSERT INTO group_members (group_id, person_id) SELECT $1, $2 WHERE NOT EXISTS (SELECT * FROM group_members WHERE group_id=$1 AND person_id=$2);', [gid, uid], function(err, result) {
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
      client.query('DELETE FROM group_members WHERE group_id=$1 AND person_id=$2;', [gid, uid], function(err, result) {
        if (err) {
          self.redirect('/command_center/error?info=' + err);
        } else {
          self.redirect('/command_center/groups/' + gid);
        }
      });
    }
  });
}

// TODO: delete from associations too
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
        client.query('DELETE FROM groups WHERE id=$1;', [id],
          function(err, result) {
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
