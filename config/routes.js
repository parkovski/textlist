// Draw routes.  Locomotive's router provides expressive syntax for drawing
// routes, including support for resourceful routes, namespaces, and nesting.
// MVC routes can be mapped mapped to controllers using convenient
// `controller#action` shorthand.  Standard middleware in the form of
// `function(req, res, next)` is also fully supported.  Consult the Locomotive
// Guide on [routing](http://locomotivejs.org/guide/routing.html) for additional
// information.
module.exports = function routes() {
  this.root('home#main');

  // login/logout
  this.match('login', 'login#authenticate', { via: 'POST' });
  this.match('logout', 'login#logout', { via: 'POST' });
  this.match('login/uhoh', 'login#uhoh');

  // command center
  this.match('command_center', 'command_center#main');
  this.match('command_center/error', 'command_center#error');
  this.match('command_center/text/new', 'command_center#new_text');
  this.match('command_center/text/send', 'command_center#send_text',
      { via: 'POST' });
  this.match('command_center/call/new', 'command_center#new_call');
  this.match('command_center/call/send', 'command_center#send_call',
      { via: 'POST' });
  this.match('command_center/schedule/new', 'command_center#new_schedule');
  this.match('command_center/schedule', 'command_center#schedule');

  this.match('command_center/numbers', 'command_center#numbers');
  this.match('command_center/numbers/new', 'command_center#newNumber',
      { via: ['GET', 'POST'] });
  this.match('command_center/numbers/:id/delete',
      'command_center#deleteNumber', { via: ['GET', 'POST'] });

  this.match('command_center/groups', 'command_center#groups');
  this.match('command_center/groups/new', 'command_center#newGroup',
    { via: ['GET', 'POST'] });
  this.match('command_center/groups/:id', 'command_center#editGroup');
  this.match('command_center/groups/:id/save', 'command_center#saveGroup',
    { via: 'POST' });
  this.match('command_center/groups/:id/delete',
    'command_center#deleteGroup', { via: ['GET', 'POST'] });

  // setup
  this.match('setup', 'setup#main');
  this.match('setup/confirm', 'setup#confirm');
  this.match('setup/finish', 'setup#finish', { via: 'POST' });
}
