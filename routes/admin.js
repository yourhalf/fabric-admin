'use strict';

const log  = require('../utils/logger.js');
const config = require('../configuration/config.json');
const bcClient = require('../blockchain/bcClient');

exports.init = function(req, res) {
	return bcClient.init()
	.then((chain) => {
		log.info("초기화 성공: " + chain);
		res.status(200).send({ msg : chain });
	}).catch((err) => {
		log.error('초기화 실패 - ' + err.message);
		res.status(500).send({ error : err.message });
	});
};

exports.register = function(req, res) {
	let memberId = req.param("memberId");
	return bcClient.register(memberId)
	.then((secret) => {
		log.info("Member ID: " + memberId + ", Secret : " + secret);
		res.status(200).jsonp({ msg : secret });
	}).catch((err) => {
		log.error('register - ' + err);
		res.status(500).jsonp({ error : err.message });
	});
};
