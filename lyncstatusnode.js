'use strict';

var meshblu = require('meshblu');
var async = require('async');
var config = require('./config.json');
var meshblu_config = require('./meshblu.json');
var lync_auth = require('./lyncAuth.js');

var lync_user = undefined;

var conn = meshblu.createConnection({
  'uuid': meshblu_config.uuid,
  'token': meshblu_config.token
});

conn.on('notReady', function(data) {
  console.log('UUID FAILED AUTHENTICATION!');
  console.log(data);
});

conn.on('ready', function(data) {
  console.log('UUID AUTHENTICATED!');
  console.log(data);

  if(!lync_user)
    connect_to_lync();
});

var count = 0;
conn.on('message', function(message) {
  if(lync_user) {
    if(message.params && message.params.setLocation) {
      lync_user.setLocation(message.params.setLocation, function(err) {
        if(err && lync_user) {
          lync_user = undefined;
          connect_to_lync();
          return;
        }
      });
    }
    else if(message.params && message.params.setNote) {
      lync_user.setNote(message.params.setNote, function(err) {
        if(err && lync_user) {
          lync_user = undefined;
          connect_to_lync();
          return;
        }
      });
    }
    else {
      async.parallel([
          function(callback) { lync_user.getAvailability(callback); },
          function(callback) { lync_user.getLocation(callback); },
          function(callback) { lync_user.getNote(callback); }
        ],
        function(err, results) {
          if(err) {
            if(lync_user) {
              lync_user = undefined;
              connect_to_lync();
            }

            conn.message('*', {
              'error': err
            });

            return;
          }

          conn.message('*', {
            'presence': results[0],
            'location': results[1],
            'note': results[2]
          });
        }
      );

      process.stdout.write('.');

      if((count = (count + 1) % 75) == 0) {
        process.stdout.write('\n');
      }
    }
  }
  else {
    conn.message('*', {
      'error': 'not connected to lync'
    });
  }
});

var connecting = false;

function connect_to_lync() {
  if(connecting) return;

  connecting = true
  lync_auth(config, function(err, lync_user_obj) {
    if(err) {
      console.error(err);
      connecting = false;
      return;
    }
    
    lync_user = lync_user_obj;
    console.log('Connected to lync.');

    connecting = false;
  });
}
