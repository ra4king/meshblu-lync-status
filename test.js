/*
{
  "geo": {
    "range": [
      1064186624,
      1064186879
    ],
    "country": "US",
    "region": "CA",
    "city": "San Jose",
    "ll": [
      37.1894,
      -121.7053
    ],
    "metro": 807
  },
  "ipAddress": "63.110.51.11",
  "online": false,
  "place": "CitrixOffice",
  "timestamp": "2015-07-13T23:10:21.296Z",
  "type": "dummy_type",
  "uuid": "cc3bf120-50ad-4f20-9aa3-66151412cff1",
  "token": "5a1b48bc786c24ef59c2a38466bcbf8a2e10ff40"
}

{
  "geo": {
    "range": [
      1064186624,
      1064186879
    ],
    "country": "US",
    "region": "CA",
    "city": "San Jose",
    "ll": [
      37.1894,
      -121.7053
    ],
    "metro": 807
  },
  "ipAddress": "63.110.51.11",
  "online": false,
  "timestamp": "2015-07-13T23:10:38.164Z",
  "type": "dummy_type2",
  "uuid": "e04f5fac-8f9e-4765-9bc1-a02d1e16f2dd",
  "token": "f069bc8a1fff5eaa523667a087b2ef3df739009e"
}
*/

var Meshblu = require('meshblu');
var meshblu = Meshblu.createConnection({
	'uuid': 'e04f5fac-8f9e-4765-9bc1-a02d1e16f2dd',
	'token': 'f069bc8a1fff5eaa523667a087b2ef3df739009e'
});
meshblu.on('ready', function(data) {
	console.log('READY:', data);

	meshblu.devices({ 'place': 'CitrixOffice' }, function(result) {
		console.log(result || 'NO RESULT');
	});
});
