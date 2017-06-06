'use strict';

const log  = require('../utils/logger.js');
const config = require('../configuration/config.json');
const bcClient = require('../blockchain/bcClient');

exports.openPage = function(req, res){
	res.render('transaction');
};

exports.query = function(req, res)	{
	let invoker = req.param("invoker");
	let id = req.param("chainCodeId");
	let ver = req.param("chainCodeVer");
	let fcn = req.param("fcn");
	let args = req.param("args").split(' ');

	//ver 생략 가능
	return bcClient.queryChaincode(invoker, id, fcn, args, ver)
	.then(function(data){
		res.status(200).send({ msg : data });
	})
	.catch(function(err) {
		log.error('query - ' + err);
		res.status(500).send({ error : err.message });
	});
}

exports.invoke = function(req, res)	{
	let invoker = req.param("invoker");
	let id = req.param("chainCodeId");
	let ver = req.param("chainCodeVer");
	let fcn = req.param("fcn");
	let args = req.param("args").split(' ');

	//ver 생략 가능
	return bcClient.invokeChaincode(invoker, id, fcn, args, ver)
	.then(function(data){
		res.status(200).send({ msg : data });
	})
	.catch(function(err) {
		log.error('invoke - ' + err);
		res.status(500).send({ error : err.message });
	});
}
