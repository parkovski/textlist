var locomotive = require('locomotive')
  , Controller = locomotive.Controller
  , pg = require('pg')
  , async = require('async')
  , time = require('time')
  , twilio = require('twilio');

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

  var connStr = 'postgres://' + settings.dbuser + ':' +
    settings.dbpass + '@' + settings.dbhost + '/' + settings.dbname;

  pg.connect(connStr, function(err, client, done) {
    callback(err, client);
    // the new pg lib requires this, but the old one crashes on it :(
    if (done) {
      done();
    }
  });
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

CommandCenterController.newMessage = function() {
  var self = this;
  getPgConn(function(err, client) {
    if (err) {
      self.redirect('/command_center/error?info=' + err);
    } else {
      var q1 = 'SELECT * FROM groups;';
      var q2 = 'SELECT * FROM people;';
      async.map([q1, q2], function(item, callback) {
        client.query(item, callback);
      }, function(err, results) {
        if (err) {
          self.redirect('/command_center/error?info=' + err);
        } else {
          if (!self.title) {
            self.title = 'New ' + self.type;
          }
          if (self.type == 'schedule') {
            self.submiturl = 'schedule/submit';
          } else {
            self.submiturl = self.type + '/send';
          }
          self.jquery = true;
          self.groups = results[0].rows;
          self.people = results[1].rows;
          self.render('new_message');
        }
      });
    }
  });
}

CommandCenterController.sendMessage = function() {
  var self = this;
  getPgConn(function(err, client) {
    if (err) {
      self.redirect('/command_center/error?info=' + err);
    } else {
      var people = [];
      var groups = [];
      var recips = self.param('recipient') || [];
      var message = self.param('message');
      if (!message) {
        self.redirect('/command_center/error?info=no message was specified');
      }
      if (typeof recips == 'string') {
        if (recips.length) {
          recips = recips.split(',');
        } else {
          recips = [];
        }
      }
      for (var i = 0; i < recips.length; ++i) {
        var id = NaN;
        var arr;
        if (recips[i].substring(0, 6) == 'person' && recips[i].length > 6) {
          id = parseInt(recips[i].substring(6), 10);
          arr = people;
        } else if (recips[i].substring(0, 5) == 'group' && recips[i].length > 5) {
          id = parseInt(recips[i].substring(5), 10);
          arr = groups;
        }
        if (!isNaN(id)) {
          arr.push(id);
        }
      }
      var groupQuery = 'SELECT phonenr FROM people WHERE id IN' +
        ' (SELECT person_id FROM group_members WHERE group_id IN (';
      var peopleQuery = 'SELECT phonenr FROM people WHERE id IN (';
      var sqlId = 1;
      for (var i = 0; i < groups.length; ++i) {
        groupQuery += '$'+sqlId;
        ++sqlId;
        if (i < groups.length - 1) {
          groupQuery += ', ';
        } else {
          groupQuery += '))';
        }
      }
      for (var i = 0; i < people.length; ++i) {
        peopleQuery += '$'+sqlId;
        ++sqlId;
        if (i < people.length - 1) {
          peopleQuery += ', ';
        } else {
          peopleQuery += ')';
        }
      }
      var allIds = groups.concat(people);
      if (allIds.length == 0) {
        self.redirect('/command_center/error?info=no recipients selected');
      } else {
        var query;
        if (groups.length) {
          query = groupQuery;
          if (people.length) {
            query += '\nUNION\n' + peopleQuery;
          }
        } else {
          query = peopleQuery;
        }
        query += ';';
        client.query(query, allIds, function(err, result) {
          if (err) {
            self.redirect('/command_center/error?info=' + err);
          } else {
            var nrs = [];
            for (var i = 0; i < result.rows.length; ++i) {
              nrs.push(result.rows[i].phonenr);
            }
            self._doTwilioCall(message, nrs, self.type);
            self.redirect('/command_center');
          }
        });
      }
    }
  });
}

CommandCenterController.newText = function() {
  this.type = 'text';
  this.newMessage();
}

CommandCenterController.sendText = function() {
  this.type = 'text';
  this.sendMessage();
}

CommandCenterController.newCall = function() {
  this.type = 'call';
  this.newMessage();
}

CommandCenterController.sendCall = function() {
  this.type = 'call';
  this.sendMessage();
}

CommandCenterController.schedule = function() {
  this.title = 'Schedule';
  this.render();
}

CommandCenterController._getScheduleVars = function() {
  return {
    recipient: this.param('recipient'),
    message: this.param('message'),
    day0: this.param('day0'),
    day1: this.param('day1'),
    day2: this.param('day2'),
    day3: this.param('day3'),
    day4: this.param('day4'),
    day5: this.param('day5'),
    day6: this.param('day6'),
    day7: this.param('day7'),
    time: this.param('time'),
    msgtype: this.param('msgtype')
  };
}

CommandCenterController._getRecipientArrays = function(recips) {
  if (!recips) {
    return { people: [], groups: [] };
  }
  var all = recips.split(',');
  var people = [];
  var groups = [];
  for (var i = 0; i < all.length; ++i) {
    var id = NaN;
    if (all[i].substring(0, 5) == 'group' && all[i].length > 5) {
      id = parseInt(all[i].substring(5), 10);
      if (!isNaN(id)) {
        groups.push(id);
      }
    } else if (all[i].substring(0, 6) == 'person' && all[i].length > 6) {
      id = parseInt(all[i].substring(6), 10);
      if (!isNaN(id)) {
        people.push(id);
      }
    }
  }
  return { people: people, groups: groups };
}

CommandCenterController._getScheduleVarString = function(vars) {
  var url = '';
  for (var v in vars) {
    if (vars.hasOwnProperty(v) && typeof vars[v] != 'undefined') {
      url += '&' + v + '=' + encodeURIComponent(vars[v]);
    }
  }
  return url.substring(1);
}

// The vars parameter here is not the same as the one returned by
// _getScheduleVars. See usage in newSchedule.
CommandCenterController._addCronJob = function(vars) {
  var now = new Date();
  var daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var thisYear = now.getYear();
  var thisMonth = now.getMonth();
  var today = now.getDate();
  var self = this;

  // leap year
  if (thisYear % 4 == 0 && thisYear % 100 != 0) {
    daysInMonths[1] = 29;
  }

  getPgConn(function(err, client) {
    if (err) {
      return err;
    } else {
      // this stuff only works because we aren't looking more than
      // a week in advance. time is hard :(.
      for (var i = 0; i < vars.days.length; ++i) {
        var targetDay = today + vars.days[i];
        var targetMonth = thisMonth;
        var targetYear = thisYear;
        if (targetDay > daysInMonths[thisMonth]) {
          targetDay -= daysInMonths[thisMonth];
          ++targetMonth;
          if (targetMonth == 12) {
            targetMonth = 0;
            ++targetYear;
          }
        }

        // TODO: Add the cron job.
      }
    }
  });
}

CommandCenterController._doTwilioCall = function(message, numbers, type) {
  // TODO: finish me.
  var client = new twilio.RestClient(settings.twiliokey, settings.twiliosecret);

  var verb = 'sendSms';
  if (type === 'call') verb = 'makeCall';

  var self = this;

  client[verb]({
    to: numbers[0],
    from: settings.twiliophone,
    body: message
  }, function(err, sentMessage) {
    if (err) {
      console.log(err);
    }
  });
}

CommandCenterController.newSchedule = function() {
  this.type = 'schedule';
  this.title = 'Schedule a call or text';

  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
              'Thursday', 'Friday', 'Saturday'];
  var today = new Date().getDay();

  days = days.splice(today, days.length - today).concat(days);
  days.push('Next ' + days[0]);
  days[0] += ' (today)';
  this.days = days;
  this.vars = this._getScheduleVars();
  this.vars.recipients = this._getRecipientArrays(this.vars.recipient);
  this.vars.days = [false, false, false, false, false, false, false, false];
  if (this.vars.message) {
    this.vars.message = this.vars.message
      .replace(/(["'\\])/g, '\\$1')
      .replace(/\r?\n/g, '\\n');
  }
  if (this.vars.time) {
    this.vars.time = this.vars.time
      .replace(/(["'\\])/g, '\\$1')
      .replace(/\r?\n/g, '\\n');
  }
  for (var i = 0; i < this.vars.days.length; ++i) {
    if (this.vars['day' + i]) {
      this.vars.days[i] = true;
    }
  }
  this.newMessage();
}

CommandCenterController.scheduleError = function() {
  this.title = 'Schedule error';
  this.info = this.param('info') || '';
  this.redirurl = '/command_center/schedule/new?' +
    this._getScheduleVarString(this._getScheduleVars());
  this.render();
}

CommandCenterController.submitSchedule = function() {
  var vars = this._getScheduleVars();
  var error = null;
  var hrs, mins;
  var days = [];
  do {
    // Is the time valid?
    var timematch =
      /^(10|11|12|[1-9])(?::([0-5]\d))?\s*([AaPp][Mm])$/
      .exec(vars.time);
    if (!timematch) {
      error = 'Time should be in the format HH:MM AM/PM.';
      break;
    }
    // convert matched info to 24-hour format hours and minutes.
    hrs = +timematch[1];
    mins = +timematch[2] || 0;
    if (hrs == 12) {
      hrs = 0;
    }
    if (timematch[3][0] == 'P' || timematch[3][0] == 'p') {
      hrs += 12;
    }
    // If we've picked today, make sure the time hasn't passed already.
    // Known issue: if you leave the page overnight and then submit,
    // the dates you see will be a day behind the ones entered into
    // the schedule.
    if (typeof vars.day0 != 'undefined') {
      var now = new Date();
      if (now.getHours() >= hrs) {
        if (now.getHours() > hrs || now.getMinutes() >= mins) {
          error = 'You have selected a time that has already passed.';
          break;
        }
      }
    }
    for (var i = 0; i < 8; ++i) {
      if (vars['day' + i]) {
        days.push(i);
      }
    }
    if (!days.length) {
      error = 'No days were selected.';
      break;
    }
  } while (false);

  if (error) {
    this.redirect('/command_center/schedule/error/?info=' + error + '&' +
      this._getScheduleVarString(vars));
  } else {
    // Insert task into database and add to node-cron.
    var self = this;
    getPgConn(function(err, client) {
      if (err) {
        self.redirect('/command_center/schedule/error?info=' + error + '&' +
          self._getScheduleVarString(vars));
      } else {
        // do the query
        var recips = self._getRecipientArrays(vars.recipient);
        var err = self._addCronJob({
          days: days,
          hour: hrs,
          minute: mins,
          type: vars.msgtype,
          message: vars.message,
          people: recips.people,
          groups: recips.groups
        });
        if (err) {
          self.redirect('/command_center/schedule/error?info=' + err + '&' +
            self._getScheduleVarString(vars));
        } else {
          self.redirect('/command_center/schedule');
        }
      }
    });
  }
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
