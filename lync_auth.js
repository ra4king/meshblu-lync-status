'use strict';

module.exports = function(config, callback) {
  var https = require('https');
  var url = require('url');
  var fs = require('fs')
  var promise = require('promise');
  var prompt = require('prompt');

  var lync_user = require('./lync_user');

  var user_url;
  var xframe_url;
  var authorization;

  // lync discover
  new Promise(function(resolve, reject) {
    if(config.user_url) {
      xframe_url = config.xframe_url;
      user_url = config.user_url;
      return resolve(config.user_url);
    }

    var host = 'lyncdiscoverinternal.' + config.domain;
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
  })

  // get auth url
  .then(function (user_url) {
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
        
        var parts = res.headers['www-authenticate'].split(',');
        var auth_url;
        for(var i = 0; i < parts.length; i++) {
          var part = parts[i];
          if (part.indexOf('MsRtcOAuth') != -1) {
            resolve(part.substring(part.indexOf('href=') + 5).replace(/'/g, ''));
          }
        }
      }).end();
    });
  }, something_went_wrong('lync discover'))

  // authenticate and get applications_url
  .then(function (auth_url) {
    return new Promise(function(resolve, reject) {
      fs.exists('./auth', function(exists) {
        if(exists) {
          fs.readFile('./auth', function(err, data) {
            if (err) return reject(err);

            var auth = JSON.parse(data.toString());

            // expires is in seconds, timestamp/Date.now() is in milliseconds
            if(auth.timestamp + auth.expires * 1000 <= Date.now()) {
              console.log('auth has expired...');
              reject(null);
            }
            else resolve(auth.auth);
          });
        }
        else {
          reject(null);
        }
      });
    }).then(function(auth) {
      authorization = auth;
      return auth;
    }, function(err) {
      return authenticate(auth_url);
    });
  }, something_went_wrong('getting auth url'))

  // get applications url
  .then(function(authorization) {
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
        if(res.statusCode != 200)
          return reject(res);
        
        var all_data = '';

        res.on('data', function(data) {
          all_data += data;
        });

        res.on('end', function() {
          resolve(JSON.parse(all_data.toString())._links.applications.href);
        });
      }).end();
    });
  }, function(err) {
    throw err;
  })

  // get user links
  .then(function(applications_url) {
    var url_parts = url.parse(applications_url);

    var body = JSON.stringify(config.application);

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

    https.request(request_properties, function(res) {
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
          callback(null, new lync_user(url_parts.hostname, xframe_url, authorization, links));
        }
      });
    }).end(body);
  }, function(msg) {
    try {
      something_went_wrong('\'user\' resource')(msg);
    } catch(err) {}

    callback('Something went wrong.');
  });

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

          callback(null, new lync_user(application_url.host, xframe_url, authorization, links));
        });
      }).end();
    }, something_went_wrong('\'makeMeAvailable\' resource'));
  }
  
  function authenticate(auth_url) {
    return new Promise(function(resolve, reject) {
      prompt.start();
      prompt.get([{name: 'username'},{name: 'password',hidden: true}], function(err, result) {
        if(err)
          return reject(null);
        
        var url_parts = url.parse(auth_url);
        
        var request_properties = {
          hostname: url_parts.hostname,
          path: url_parts.pathname,
          method: 'POST',
          headers: {
            'Host': url_parts.hostname,
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded;charset=\'utf-8\'',
            'Referer': xframe_url,
            'Cache-Control': 'no-cache'
          }
        };
        
        https.request(request_properties, function(res) {
          if(res.statusCode != 200)
            return reject('Invalid credentials.');
          
          var all_data = '';

          res.on('data', function(data) {
            all_data += data;
          });
          
          res.on('end', function() {
            var auth = JSON.parse(all_data.toString());
            authorization = auth.token_type + ' ' + auth.access_token;
            expires = auth.expires_in;
            resolve({auth: authorization, expires: expires});
          });
        }).end('grant_type=password&username=' + result.username + '&password=' + result.password);
      });
    }).then(function(auth) {
      console.log('Authentication successful.');
      
      return new Promise(function(resolve, reject) {
        var fs = require('fs');

        var auth_body = {
          'auth': auth.auth,
          'timestamp': Date.now(),
          'expires': auth.expires
        };

        fs.writeFile('./auth', JSON.stringify(auth_body));

        resolve(auth.auth);
      });
    }, function(reject) {
      if(!reject) {
        throw null;
      }

      console.log(reject);
      return authenticate(auth_url);
    });
  }

  function something_went_wrong(info) {
    return function(msg) {
      console.log('Something went wrong with', info);
      
      if(msg.statusCode != undefined) {
        console.log('Status code:', msg.statusCode);
        console.log('Status message:', msg.statusMessage);
        console.log('Headers:', JSON.stringify(msg.headers));
      }
      else {
        console.log(msg);
      }

      throw msg;
    }
  }
}
