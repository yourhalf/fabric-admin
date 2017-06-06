'use strict';

const log  = require('../utils/logger.js');
const config = require('../configuration/config.json');
const bcClient = require('../blockchain/bcClient');

exports.openPage = function(req, res){
	res.render('member', { adminUrl : config.adminUrl });
};

exports.init = function(req, res) {
	bcClient.init();
};

exports.enroll = function(req, res) {
	let memberId = req.param("memberId");
	let secret = req.param("secret");
	
	return bcClient.enroll(memberId, secret)
	.then((user) => {
		log.info("등록 성공: " + user.getName());
		res.status(200).send({ msg : user.getName() });
	}).catch((err) => {
		log.error('enroll - ' + err.message);
		res.status(500).send({ error : err.message });
	});
};

exports.getUser = function(req, res) {
	let memberId = req.param("memberId");
	
	return bcClient.getUser(memberId)
	.then((user) => {
		log.info("로그인 성공: " + user.getName());
		
		req.session.user = {
                userId : user.getName()
        };

		res.status(200).send({ msg : user.getName() });
	}).catch((err) => {
		log.error('enroll - ' + err.message);
		res.status(500).send({ error : err.message });
	});
};

