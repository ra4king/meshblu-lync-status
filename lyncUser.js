'use strict';

module.exports = function(host, xframe_url, authorization, links) {
  this.host = host;
  this.xframe_url = xframe_url;
  this.authorization = authorization;
  this.links = links;

  var https = require('https');

  this.getAvailability = function(callback) {
    var request_properties = {
      hostname: this.host,
      path: this.links._embedded.me._links.presence.href,
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

    console.log(body);

    var request_properties = {
      hostname: this.host,
      path: this.links._embedded.me._links.location.href,
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
    }).end(body);
  };

  this.getLocation = function(callback) {
    var request_properties = {
      hostname: this.host,
      path: this.links._embedded.me._links.location.href,
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

    console.log(body);

    var request_properties = {
      hostname: this.host,
      path: this.links._embedded.me._links.note.href,
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
    }).end(body);
  }

  this.getNote = function(callback) {
    var request_properties = {
      hostname: this.host,
      path: this.links._embedded.me._links.note.href,
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
