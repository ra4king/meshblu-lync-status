'use strict';

module.exports = function(host, xframe_url, authorization, me) {
  this.host = host;
  this.xframe_url = xframe_url;
  this.authorization = authorization;
  this.me = me;

  var https = require('https');

  this.getName = function() {
    return this.me.name;
  }

  this.getAvailability = function(callback) {
    var request_properties = {
      hostname: this.host,
      path: this.me._links.presence.href,
      headers: {
        'Host': this.host,
        'Authorization': authorization,
        'Referer': xframe_url,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    };

    https.request(request_properties, function(res) {
      if(res.statusCode != 200)
        return callback('Error from webserver. Status code: ' + res.statusCode);

      var all_data = '';

      res.on('data', function(data) {
        all_data += data;
      });

      res.on('end', function() {
        var info = JSON.parse(all_data);
        callback(null, info.availability);
      });
    }).end();
  };

  this.setLocation = function(location, callback) {
    var body = JSON.stringify({ 'location': location });

    var request_properties = {
      hostname: this.host,
      path: this.me._links.location.href,
      method: 'POST',
      headers: {
        'Host': this.host,
        'Authorization': authorization,
        'Referer': xframe_url,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Content-Length': body.length
      }
    };

    https.request(request_properties, function(res) {
      if(res.statusCode != 204)
        return callback('Error from webserver. Status code: ' + res.statusCode);
      callback();
    }).end(body);
  };

  this.getLocation = function(callback) {
    var request_properties = {
      hostname: this.host,
      path: this.me._links.location.href,
      headers: {
        'Host': this.host,
        'Authorization': authorization,
        'Referer': xframe_url,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    };

    https.request(request_properties, function(res) {
      if(res.statusCode != 200)
        return callback('Error from webserver. Status code: ' + res.statusCode);

      var all_data = '';

      res.on('data', function(data) {
        all_data += data;
      });

      res.on('end', function() {
        var info = JSON.parse(all_data);
        callback(null, info.location);
      });
    }).end();
  };

  this.setNote = function(note, callback) {
    var body = JSON.stringify({ 'message': note });

    var request_properties = {
      hostname: this.host,
      path: this.me._links.note.href,
      method: 'POST',
      headers: {
        'Host': this.host,
        'Authorization': authorization,
        'Referer': xframe_url,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Content-Length': body.length
      }
    };

    https.request(request_properties, function(res) {
      if(res.statusCode != 204)
        return callback('Error from webserver. Status code: ' + res.statusCode);
      callback();
    }).end(body);
  }

  this.getNote = function(callback) {
    var request_properties = {
      hostname: this.host,
      path: this.me._links.note.href,
      headers: {
        'Host': this.host,
        'Authorization': authorization,
        'Referer': xframe_url,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    };

    https.request(request_properties, function(res) {
      if(res.statusCode != 200)
        return callback('Error from webserver. Status code: ' + res.statusCode);

      var all_data = '';

      res.on('data', function(data) {
        all_data += data;
      });

      res.on('end', function() {
        var info = JSON.parse(all_data);
        callback(null, info.message);
      });
    }).end();
  };
}
