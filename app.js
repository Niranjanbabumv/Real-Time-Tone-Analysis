/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express   = require('express'),
  app         = express(),
  bodyParser  = require('body-parser'),
  cfenv       = require('cfenv'),
  watson      = require('watson-developer-cloud'),
  nodemailer  = require('nodemailer'),
  smtpTransport = require('nodemailer-smtp-transport');

// Set up environment variables
// cfenv provides access to your Cloud Foundry environment
var vcapLocal = null;
try {
  vcapLocal = require("./vcap-local.json");
}
catch (e) {}

var appEnvOpts = vcapLocal ? {vcap:vcapLocal} : {};
var appEnv = cfenv.getAppEnv(appEnvOpts);

// Configure Express
// serve the files out of ./public as our main files
app.enable('trust proxy');

app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(__dirname + '/public'));

// Deployment tracker code snippet
require("cf-deployment-tracker-client").track();

// Start listening for connections
app.listen(appEnv.port, function() {
  console.log("server started at", appEnv.url);
});

// Configure Watson Speech to Text service
var speechCreds = getServiceCreds(appEnv, 'rtt-speech-to-text');
speechCreds.version = 'v1';
var authService = watson.authorization(speechCreds);

// Configure Watson Speech to Text service
var toneCreds = getServiceCreds(appEnv, 'rtt-tone-analyzer');
toneCreds.version = 'v3';
toneCreds.version_date = '2016-05-19';
var toneAnalyzer = watson.tone_analyzer(toneCreds);

// Root page handler
app.get('/', function(req, res) {
  res.render('index', { ct: req._csrfToken });
});

// Get token using your credentials
app.post('/api/token', function(req, res, next) {
  authService.getToken({url: speechCreds.url}, function(err, token) {
    if (err)
      next(err);
    else
      res.send(token);
  });
});

// Request handler for tone analysis
app.post('/api/tone', function(req, res, next) {
  toneAnalyzer.tone(req.body, function(err, data) {
    if (err)
      return next(err);
    else
      return res.json(data);
  });
});

// Send email
app.post('/api/email', function(req, res, next) {
	console.log(req.body);
		var transporter = nodemailer.createTransport(smtpTransport({
		  service: 'gmail',
		  host: 'smtp.gmail.com',
		  auth: {
			user: 'prem09.dutt06@gmail.com',
			pass: 'sharma06@'
		  }
		}));

		var mailOptions = {
		  from: 'prem09.dutt06@gmail.com',
		  to: req.body.name,
		  subject: req.body.toneType,
		  text: req.body.transcription
		};

		transporter.sendMail(mailOptions, function(error, info){
		  if (error) {
			console.log(error);
		  } else {
			res.send('Email sent: ' + info.response);
		  }
		});
});

// error-handler settings
require('./config/error-handler')(app);

// Retrieves service credentials for the input service
function getServiceCreds(appEnv, serviceName) {
  var serviceCreds = appEnv.getServiceCreds(serviceName);
  if (!serviceCreds) {
    console.log("service " + serviceName + " not bound to this application");
    return null;
  }
  return serviceCreds;
}
