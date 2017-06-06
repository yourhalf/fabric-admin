const express = require('express');
const http = require('http');
const path = require('path');
const expressSession = require("express-session");
const url = require('url');

const log  = require('./utils/logger.js');
const config = require('./configuration/config.json');
const bcClient = require('./blockchain/bcClient');

const admin = require('./routes/admin');
const member = require('./routes/member');
const chaincode = require('./routes/chaincode');
const transaction = require('./routes/transaction');

const bankcertcc = require('./cctest/bankcertcc');

const app = express();


// all environments
app.set('port', process.env.PORT || config.clientPort);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.bodyParser());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {	
  app.use(express.errorHandler());
}

app.get('/init', admin.init);
app.get('/register', admin.register);

app.get('/', member.openPage);
app.get('/member', member.openPage);
app.post('/enroll', member.enroll);
app.post('/getUser', member.getUser);

app.get('/cc', chaincode.openPage);
app.post('/instChainCode', chaincode.instChainCode);
app.post('/initChainCode', chaincode.initChainCode);

app.get('/tr', transaction.openPage);
app.post('/query', transaction.query);
app.post('/invoke', transaction.invoke);

app.post('/bankcertcc/getUser', bankcertcc.getUser);
app.post('/bankcertcc/verify', bankcertcc.verify);
app.post('/bankcertcc/store', bankcertcc.store);

http.createServer(app).listen(app.get('port'), function(){
  log.info('Express server listening on port ' + app.get('port'));
});

bcClient.startUp();
