'use strict';

const log  = require('../utils/logger.js');
const config = require('../configuration/config.json');
const bcClient = require('../blockchain/bcClient');
const fs = require('fs');
const chainCodeId = "bankcertcc";

exports.openPage = function(req, res){
	res.render('transaction');
};

exports.getUser = function(req, res)	{
	let invoker = req.param("invoker");
	let argsTemp = req.param("args").split(' ');
	
	let args = [argsTemp[0]];
	
	bcClient.queryChaincode(invoker, chainCodeId, "getUserInfo", args)
	.then(function(data){
		res.status(200).send({ msg : data });
	})
	.catch(function(err) {
		log.error('query - ' + err);
		res.status(500).send({ error : err.message });
	});
}

exports.verify = function(req, res)	{
	let invoker = req.param("invoker");
	let argsTemp = req.param("args").split(' ');
	
	let args = [fs.readFileSync(process.env['HOME'] + "/" + argsTemp[0]),
				  fs.readFileSync(process.env['HOME'] + "/" + argsTemp[1]),
				  fs.readFileSync(process.env['HOME'] + "/" + argsTemp[2]), argsTemp[3]];
	
	bcClient.queryChaincode(invoker, chainCodeId, "verifySignature", args)
	.then(function(data){
		res.status(200).send({ msg : data });
	})
	.catch(function(err) {
		log.error('query - ' + err);
		res.status(500).send({ error : err.message });
	});
}

exports.store = function(req, res)	{
	let invoker = req.param("invoker");
	let argsTemp = req.param("args").split(' ');
	let args = [argsTemp[0], argsTemp[1], argsTemp[2], argsTemp[3]];

	//ver 생략 가능
	bcClient.invokeChaincode(invoker, chainCodeId, "storeUserInfo", args)
	.then(function(data){
		res.status(200).send({ msg : data });
	})
	.catch(function(err) {
		log.error('invoke - ' + err);
		res.status(500).send({ error : err.message });
	});
}



