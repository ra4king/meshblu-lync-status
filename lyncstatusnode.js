
var https = require('https');
var url = require('url');
var fs = require('fs')
var promise = require('promise');
var prompt = require('prompt');
var config = require('./config.json');

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
	console.log(host);
	var request_properties = {
		hostname: host,
		headers: {
			"Host": host,
			"Cache-Control": "no-cache"
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

			console.log(xframe_url);
			console.log(user_url);

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
				"Host": url_parts.hostname,
				"Referer": xframe_url,
				"Cache-Control": "no-cache"
			}
		};

		https.request(request_properties, function(res) {
			if(res.statusCode != 401) {
				reject(res);
				return;
			}
			
			var parts = res.headers['www-authenticate'].split(',');
			for(var i = 0; i < parts.length; i++) {
				var part = parts[i];
                if (part.indexOf("MsRtcOAuth") != -1) {
					resolve(part.substring(part.indexOf("href=") + 5).replace(/"/g, ''));
				}
			}
		}).end();
	});
}, something_went_wrong("lync discover"))

// authenticate
.then(function (auth_url) {
	return new Promise(function(resolve, reject) {
		if(fs.existsSync('./auth')) {
			fs.readFile('./auth', function(err, data) {
                if (err) return reject(err);
                
				resolve(data.toString());
			});
		}
		else {
			reject(null);
		}
	}).then(function(auth) {
		return new Promise(function(resolve, reject) {
			authorization = auth;
			resolve(auth);
		});
	}, function(err) {
		return authenticate(auth_url);
	});
}, something_went_wrong("getting auth url"))

// get applications url
.then(function(authorization) {
	return new Promise(function(resolve, reject) {
		var url_parts = url.parse(user_url);
		
		var request_properties = {
			hostname: url_parts.hostname,
			path: url_parts.pathname,
			headers: {
				"Host": url_parts.hostname,
				"Authorization": authorization,
				"Referer": xframe_url,
				"Accept": "application/json",
				"Cache-Control": "no-cache"
			}
		};
		
		https.request(request_properties, function(res) {
			if(res.statusCode != 200) {
				reject(res);
				return;
			}
			
			var all_data = '';

			res.on('data', function(data) {
				all_data += data;
			});

			res.on('end', function() {
				resolve(JSON.parse(all_data.toString())._links.applications.href);
			});
		}).end();
	});
})

// get user links
.then(function(applications_url) {
	return new Promise(function(resolve, reject) {
		var url_parts = url.parse(applications_url);

		var body = JSON.stringify(config.application);

		var request_properties = {
			hostname: url_parts.hostname,
			path: url_parts.pathname,
			method: "POST",
			headers: {
				"Host": url_parts.hostname,
				"Authorization": authorization,
				"Referer": xframe_url,
				"Accept": "application/json",
				"Content-Type": "application/json",
				"Cache-Control": "no-cache",
				"Content-Length": body.length
			}
		};

		var req = https.request(request_properties, function(res) {
			if(res.statusCode != 201 && res.statusCode != 200) {
				reject(res);
				return;
			}

			var all_data = '';

			res.on('data', function(data) {
				all_data += data;
			});

			res.on('end', function() {
				makeMeAvailable = JSON.parse(all_data)._embedded.me._links.makeMeAvailable.href;
				resolve({host: url_parts.hostname, makeMeAvailable: makeMeAvailable});
			});
		});
		
		req.end(body);
	});
}, something_went_wrong("'user' resource"))

.then(function(makeMeAvailable_url) {
	console.log(makeMeAvailable_url);
}, something_went_wrong("'applications' resource"));

function authenticate(auth_url) {
	return new Promise(function(resolve, reject) {
		prompt.start();
		prompt.get([{name: "username"},{name: "password",hidden: true}], function(err, result) {
			if(err) {
				reject({ "err" : err, "auth_url": auth_url});
				return;
			}
			
			var url_parts = url.parse(auth_url);
			
			var request_properties = {
				hostname: url_parts.hostname,
				path: url_parts.pathname,
				method: "POST",
				headers: {
					"Host": url_parts.hostname,
					"Accept": "application/json",
					"Content-Type": "application/x-www-form-urlencoded;charset='utf-8'",
					"Referer": xframe_url,
					"Cache-Control": "no-cache"
				}
			};
			
			var req = https.request(request_properties, function(res) {
				if(res.statusCode != 200) {
					reject("Invalid credentials.");
					return;
				}
				
				var all_data = '';

				res.on('data', function(data) {
					all_data += data;
				});
				
				res.on('end', function() {
					var auth = JSON.parse(all_data.toString());
					authorization = auth.token_type + " " + auth.access_token;
					resolve(authorization);
				});
			});
			req.write("grant_type=password&username=" + result.username + "&password=" + result.password);
			req.end();
		});
	}).then(function(auth) {
		return new Promise(function(resolve, reject) {
			var fs = require('fs');
			fs.writeFile('./auth', auth);
			
			resolve(auth);
		});
	}, function(reject) {
		console.log(reject);
		return authenticate(auth_url);
	});
}

function something_went_wrong(info) {
	return function(msg) {
		console.log("Something went wrong with " + info);
		
		if(msg.statusCode != undefined) {
			console.log("Status code: " + msg.statusCode);
            console.log("Status message: " + msg.statusMessage);
            console.log("Headers: " + JSON.stringify(msg.headers));
		}
		else {
			console.log(msg);
		}
		
		
	}
}
