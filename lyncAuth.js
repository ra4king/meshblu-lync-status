'use strict';

module.exports = function(callback) {
  var https = require('https');
  var url = require('url');
  var fs = require('fs')
  var promise = require('promise');
  var wincredmgr = require('wincredmgr');

  var lync_user = require('./lyncUser');

  var user_url;
  var xframe_url;
  var authorization;

  var credentials;
  var configCallback;

  function setupConfigServer(message) {
    var port = 80;

    var options = {
      'name': 'Lync Status Plugin',
      'status': message,
      'port': port,
      'properties': {
        'domain': {
          'name': 'Domain',
          'type': 'text'
        },
        'username': {
          'name': 'Username:',
          'type': 'text'
        },
        'password': {
          'name': 'Password:',
          'type': 'password'
        }
      }
    };

    require('./configServer')(options, function(values, callback) {
      if(values.domain.indexOf('/') != -1) {
        callback('Domain cannot have a forward slash: /');
        return;
      }

      credentials = values;
      configCallback = callback;
      lyncDiscover();
    });
    require('open')('http://localhost:' + port);
  }

  try {
    credentials = wincredmgr.ReadCredentials('LyncStatusPluginCreds');

    var slash = credentials.username.indexOf('/');
    if(slash == -1)
      throw 'something went badly wrong';

    credentials.domain = credentials.username.substring(0, slash);
    credentials.username = credentials.username.substring(slash + 1);

    configCallback = function(err) {
      if(err)
        setupConfigServer(err);
    };

    lyncDiscover();
  } catch(e) {
    setupConfigServer();
  }

  function lyncDiscover() {
    return new Promise(function(resolve, reject) {
      var host = 'lyncdiscoverinternal.' + credentials.domain;
      var request_properties = {
        hostname: host,
        headers: {
          'Host': host,
          'Cache-Control': 'no-cache'
        }
      };

      https.request(request_properties, function(res) {
        var all_data = '';

        res.on('data', function(data) {
          all_data += data;
        });

        res.on('end', function() {
          var links = JSON.parse(all_data.toString());
          xframe_url = links._links.xframe.href;
          user_url = links._links.user.href;

          resolve(user_url);
        });
      }).end();
    }).then(function(user_url) {
      if(authorization)
        return getApplicationsURL();
      else
        return getAuthURL();
    }, function() {
      configCallback('Domain not found.');
    });
  }

  function getAuthURL() {
    return new Promise(function(resolve, reject) {
      var url_parts = url.parse(user_url);

      var request_properties = {
        hostname: url_parts.hostname,
        path: url_parts.pathname,
        headers: {
          'Host': url_parts.hostname,
          'Referer': xframe_url,
          'Cache-Control': 'no-cache'
        }
      };

      https.request(request_properties, function(res) {
        if(res.statusCode != 401)
          return reject(res);

        var authHeader = res.headers['www-authenticate'] || res.headers['WWW-Authenticate'];

        var parts = authHeader.split(',');
        for(var i = 0; i < parts.length; i++) {
          var part = parts[i];
          if (part.indexOf('MsRtcOAuth') != -1) {
            return resolve(part.substring(part.indexOf('href=') + 5).replace(/['"]/g, ''));
          }
        }

        reject('MsRtcOAuth url not found.');
      }).end();
    }).then(function(auth_url) {
      return authenticate(auth_url);
    }, something_went_wrong('getting auth url'));
  }

  function authenticate(auth_url) {
    return new Promise(function(resolve, reject) {
      var url_parts = url.parse(auth_url);

      var request_properties = {
        hostname: url_parts.hostname,
        path: url_parts.pathname,
        method: 'POST',
        headers: {
          'Host': url_parts.hostname,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Referer': xframe_url,
          'Cache-Control': 'no-cache'
        }
      };

      https.request(request_properties, function(res) {
        if(res.statusCode != 200) {
          configCallback('Invalid credentials.');
          return;
        }

        var all_data = '';

        res.on('data', function(data) {
          all_data += data;
        });

        res.on('end', function() {
          configCallback();

          var username = credentials.domain + '/' + credentials.username;
          wincredmgr.WriteCredentials(username, credentials.password, 'LyncStatusPluginCreds');

          var auth = JSON.parse(all_data.toString());
          authorization = auth.token_type + ' ' + auth.access_token;
          resolve();
        });
      }).end('grant_type=password&username=' + credentials.username + '&password=' + credentials.password);
    }).then(function(auth) {
      console.log('Authentication successful.');
      return getApplicationsURL();
    }, something_went_wrong('authenticate'));
  }

  function getApplicationsURL() {
    return new Promise(function(resolve, reject) {
      var url_parts = url.parse(user_url);

      var request_properties = {
        hostname: url_parts.hostname,
        path: url_parts.pathname,
        headers: {
          'Host': url_parts.hostname,
          'Authorization': authorization,
          'Referer': xframe_url,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      };

      https.request(request_properties, function(res) {
        if(res.statusCode == 500) {
          return reject(null);
        }

        if(res.statusCode != 200)
          return reject(res);

        var all_data = '';

        res.on('data', function(data) {
          all_data += data;
        });

        res.on('end', function() {
          var applications_url = JSON.parse(all_data.toString())._links.applications.href;
          var app_url_parts = url.parse(applications_url);

          if(url_parts.host !== app_url_parts.host) {
            console.log('Host change detected.');
            url_parts.host = app_url_parts.host;
            user_url = url.format(url_parts);

            var xframe_url_parts = url.parse(xframe_url);
            xframe_url_parts.host = app_url_parts.host;
            xframe_url = url.format(xframe_url_parts);

            return reject(null);
          }

          resolve(applications_url);
        });
      }).end();
    }).then(function(applications_url) {
      return getUserLinks(applications_url);
    }, function(msg) {
      if(!msg) {
        console.log('Invalid authentication.');
        resetAuth();
        return getAuthURL();
      }

      try {
        something_went_wrong('"user" resource')(msg);
      } catch(err) {}

      callback('Something went wrong.');
    });
  }

  function getUserLinks(applications_url) {
    var url_parts = url.parse(applications_url);

    var application = {
      "UserAgent": "LyncStatusBlu",
  		"EndpointId": require('uuid').v4(),
  		"Culture": "en-US"
    };

    var body = JSON.stringify(application);

    var request_properties = {
      hostname: url_parts.hostname,
      path: url_parts.pathname,
      method: 'POST',
      headers: {
        'Host': url_parts.hostname,
        'Authorization': authorization,
        'Referer': xframe_url,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Content-Length': body.length
      }
    };

    var req = https.request(request_properties, function(res) {
      if(res.statusCode != 201 && res.statusCode != 200)
        return callback('Error from webserver. Status code: ' + res.statusCode);

      var all_data = '';

      res.on('data', function(data) {
        all_data += data;
      });

      res.on('end', function() {
        var links = JSON.parse(all_data);

        if(links._embedded.me._links.makeMeAvailable) {
          var application = links._links.self.href;
          var makeMeAvailable_href = links._embedded.me._links.makeMeAvailable.href;
          makeMeAvailable({host: url_parts.hostname, application: application, makeMeAvailable: makeMeAvailable_href});
        }
        else {
          callback(null, new lync_user(url_parts.hostname, xframe_url, authorization, links._embedded.me));
        }
      });
    });
    req.on('error', function(err) {
      callback(err);
    });
    req.end(body);
  }

  function makeMeAvailable(makeMeAvailable_url) {
    new Promise(function(resolve, reject) {
      var body = '{"SupportedModalities":["Messaging"]}';

      var request_properties = {
        hostname: makeMeAvailable_url.host,
        path: makeMeAvailable_url.makeMeAvailable,
        method: 'POST',
        headers: {
          'Host': makeMeAvailable_url.host,
          'Authorization': authorization,
          'Referer': xframe_url,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Content-Length': body.length
        }
      };

      https.request(request_properties, function(res) {
        if(res.statusCode != 204)
          return reject(res);

        resolve({host: makeMeAvailable_url.host, application: makeMeAvailable_url.application});
      }).end(body);
    })

    // get all links and build lync_user object
    .then(function(application_url) {
      var request_properties = {
        hostname: application_url.host,
        path: application_url.application,
        headers: {
          'Host': application_url.host,
          'Authorization': authorization,
          'Referer': xframe_url,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
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
          var links = JSON.parse(all_data.toString());

          callback(null, new lync_user(application_url.host, xframe_url, authorization, links._embedded.me));
        });
      }).end();
    }, something_went_wrong('"makeMeAvailable" resource'));
  }

  function resetAuth()  {
    fs.unlink('./auth', function(err) {});
  }

  function something_went_wrong(info) {
    return function(msg) {
      console.error('Something went wrong with', info);

      if(msg.statusCode != undefined) {
        console.error('Status code:', msg.statusCode);
        console.error('Status message:', msg.statusMessage);
        console.error('Headers:', JSON.stringify(msg.headers));
      }
      else {
        console.error(msg);
      }

      throw msg;
    }
  }
}
