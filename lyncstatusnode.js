var meshblu = require('meshblu')
var config = require('./config.json');
var lync_auth = require('./lync_auth.js');

var lync_user = undefined;

var conn = meshblu.createConnection({
	"uuid": "fea309ac-0926-4e56-8d6a-df12586b0f0c",
	"token": "ea7f6b025eeb2d102134f91507e8d137f749522a",
});

conn.on('notReady', function(data) {
	console.log("UUID FAILED AUTHENTICATION!");
	console.log(data);
});

conn.on('ready', function(data) {
	console.log("UUID AUTHENTICATED!");
	console.log(data);

	connect_to_lync();
});

conn.on('message', function(message) {
	if(lync_user) {
		lync_user.getAvailability(function(err, availability) {
			if(err)
				return connect_to_lync();
			
			conn.message('*', {
				"presence": err ? "unknown" : availability
			});
		});
	}
	else {
		conn.message('*', {
			"presence": "unknown"
		});
	}
});

function connect_to_lync() {
	lync_auth(config, function(err, lync_user_obj) {
		if(err) {
			console.log(err);
			return;
		}
		
		lync_user = lync_user_obj;
	});
}
