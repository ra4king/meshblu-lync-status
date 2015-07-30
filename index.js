'use strict';
var util = require('util');
var async = require('async');
var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('meshblu-lync-status')

var MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    location: {
      type: 'string',
      required: false
    },
    note: {
      type: 'string',
      required: false
    }
  }
};

var OPTIONS_SCHEMA = {
  type: 'object',
  properties: {}
};

function Plugin(){
  this.options = {};
  this.messageSchema = MESSAGE_SCHEMA;
  this.optionsSchema = OPTIONS_SCHEMA;

  this.lync_user = undefined;
  this.connectToLync();

  return this;
}
util.inherits(Plugin, EventEmitter);

Plugin.prototype.onMessage = function(message){
  var payload = message.payload;

  var self = this;

  if(this.lync_user) {
    var getStatus = true;

    if(payload.location) {
      getStatus = false;

      self.lync_user.setLocation(payload.location, function(err) {
        if(err) {
          self.lync_user = undefined;
          connectToLync();

          self.emit('message', {
            devices: ['*'],
            payload: {
              'error': 'not connected to lync'
            }
          });

          return;
        }

        self.emit('message', {
          devices: ['*'],
          payload: {
            'success': 'location successfully set'
          }
        });
      });
    }

    if(payload.note) {
      getStatus = false;

      self.lync_user.setNote(payload.note, function(err) {
        if(err) {
          self.lync_user = undefined;
          connectToLync();

          self.emit('message', {
            devices: ['*'],
            payload: {
              'error': 'not connected to lync'
            }
          });

          return;
        }

        self.emit('message', {
          devices: ['*'],
          payload: {
            'success': 'note successfully set'
          }
        });
      });
    }

    if(getStatus) {
      async.parallel([
          function(callback) { callback(undefined, self.lync_user.getName()); },
          function(callback) { self.lync_user.getAvailability(callback); },
          function(callback) { self.lync_user.getLocation(callback); },
          function(callback) { self.lync_user.getNote(callback); }
        ],
        function(err, results) {
          if(err) {
            if(self.lync_user) {
              self.lync_user = undefined;
              connectToLync();
            }

            self.emit('message', {
              devices: ['*'],
              payload: {
                'error': err
              }
            });

            return;
          }

          self.emit('message', {
            devices: ['*'],
            payload: {
              'name': results[0],
              'presence': results[1],
              'location': results[2],
              'note': results[3]
            }
          });
        }
      );
    }
  }
  else {
    self.emit('message', {
      devices: ['*'],
      payload: {
        'error': 'not connected to lync'
      }
    });
  }
};

Plugin.prototype.onConfig = function(device){
  this.setOptions(device.options||{});
};

Plugin.prototype.setOptions = function(options){
  this.options = options;
};

Plugin.prototype.connectToLync = function() {
  if(this.connecting) return;

  var self = this;

  this.connecting = true
  require('./lyncAuth.js')(function(err, lync_user_obj) {
    if(err) {
      console.error(err);
      self.connecting = false;
      return;
    }

    self.lync_user = lync_user_obj;
    console.log('Connected to lync.');

    self.connecting = false;
  });
}

module.exports = {
  messageSchema: MESSAGE_SCHEMA,
  optionsSchema: OPTIONS_SCHEMA,
  Plugin: Plugin
};
