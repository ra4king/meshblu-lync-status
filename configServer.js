'use strict';

/*

Sets up an HTTP server for querying properties from a user. When the server is setup,
the default browser is automatically opened to the page.

options: {
  'name': name to be displayed in title and header
  'status': OPTIONAL, status message to initially show
  'port': OPTIONAL, port to use. Otherwise port 80 will be attempted. If listening on
          port fails, it will keep retrying on a different port.
  'autoopen': OPTIONAL, if true, the default browser is automatically opened. Default true.
  'properties':
    [
      'propertyName': {
        'name': OPTIONAL name to show before input, otherwise propertyName is used
        'type': the HTML form input type
        'value': OPTIONAL value of property
      },
      ...
    ]
  }
}

callback: function(values, callback)
  values
    an object with keys as all defined propertyNames along with their values
  callback([error])
    call with no parameters to signal configuration success. The HTTP server is closed
    call with a string parameter to signal configuration error, shown as the status message
*/
module.exports = function(options, callback) {
  options = options || {};
  var port = options.port || 80;

  function populateBody(values, status) {
    values = values || {};

    var title = (options.name || '') + ' Configuration';

    var body = '<!DOCTYPE html><html><head><title>' + title + '</title>';

    body += '<style type="text/css">body { text-align: center; font-family: sans-serif } .input { padding: 3 }</style>';

    body += '</head>';
    body += '<body><h1>' + title + '</h1>';

    if(status)
      body += '<h3>' + status + '</h3>';

    body += '<form method="POST">';
    for(var property in options.properties) {
      var opts = options.properties[property];
      body += '<div class="input">' + (opts.name || property) + ' <input type="' + opts.type + '" name="' + property + '" value="' +
              (values[property] || opts.value || '') + '" /></div><br/>';
    }
    body += '<div class="input"><input type="submit" value="Submit" /></div>';
    body += '</form></body></html>';
    return body;
  }

  var server = require('http').createServer(function(request, response) {
    if(request.url !== '/') {
      var body = '<!DOCTYPE html><html><head><title>404 - Not Found</title></head><body><h1>404 - Page not found</h1></body></html>';

      response.writeHead(404, { 'Content-Length': body.length,
                                'Content-Type': 'text/html' });
      response.end(body);
      return;
    }

    if(request.method === 'GET') {
      var body = populateBody(undefined, options.status);
      delete options.status;

      response.writeHead(200, { 'Content-Length': body.length,
                                'Content-Type': 'text/html' });
      response.end(body);
    }
    else if(request.method === 'POST') {
      var data = '';
      request.on('data', function(d) {
        data += d.toString();
      });
      request.on('end', function() {
        var values = require('querystring').parse(data);

        callback(values, function(err) {
          if(err) {
            var body = populateBody(values, err);
            response.writeHead(401, { 'Content-Length': body.length,
                                      'Content-Type': 'text/html' });
            response.end(body);
            return;
          }

          var body = '<!DOCTYPE html><html><head><title>Success</title></head><body><h1>Success</h1></body></title>';
          response.writeHead(200, { 'Content-Length': body.length,
                                    'Content-Type': 'text/html' });
          response.end(body, function() {
            request.connection.destroy();
            server.close();
          });
        });
      });
    }
  });

  function listen(port) {
    server.listen(port);
  }

  server.on('error', function(err) {
    listen(++port);
  });

  server.on('listening', function() {
    console.log('HTTP server ready');
    if(options.autoopen || options.autoopen === undefined)
      require('open')('http://localhost:' + port);
  });

  listen(port);
}
