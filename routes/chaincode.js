'use strict';

const log  = require('../utils/logger.js');
const config = require('../configuration/config.json');
const bcClient = require('../blockchain/bcClient');
const fs = require('fs');

exports.openPage = function(req, res){
	res.render('chaincode');
};

exports.instChainCode = function(req, res) {
	let chainCodeId = req.param("chainCodeId");
	let chainCodePath = req.param("chainCodePath");
	let chainCodeVer = req.param("chainCodeVer");
	let invoker = req.param("invoker");

	if(invoker == ""){
		if(req.session.user == undefined){
			log.error('Invoker 지정 안됨');
			res.status(500).send({ error : '로그인을 하거나 Invoker를 지정해야 합니다.' });
			return;
		}else{
			invoker = req.session.user.userId;
		}
	}
	
	let checkPath = process.env['GOPATH'] + '/src/' + chainCodePath;
	
	fs.exists(checkPath, function(exists) {
		if (exists) {
			bcClient.instChainCode(invoker, chainCodeId, chainCodePath, chainCodeVer)
			.then(() => {
				log.info("체인코드 Install 성공");
				res.status(200).send({ msg : '성공' });
			}).catch((err) => {
				log.error('instChainCode - ' + err.message);
				res.status(500).send({ error : err.message });
			});
		} else {
			log.error(checkPath);
			res.status(500).send({ error : checkPath + ' - 존재하지 않는 경로입니다.' });
		}
	});
};

exports.initChainCode = function(req, res) {
	let chainCodeId = req.param("chainCodeId");
	let chainCodePath = req.param("chainCodePath");
	let chainCodeVer = req.param("chainCodeVer");
	let invoker = req.param("invoker");
	let args = req.param("args").split(' ');
	let initType = false;
	if(req.param("initType") == "upgrade") initType = true;
	
	if(invoker == ""){
		if(req.session.user == undefined){
			log.error('Invoker 지정 안됨');
			res.status(500).send({ error : '로그인을 하거나 Invoker를 지정해야 합니다.' });
			return;
		}else{
			invoker = req.session.user.userId;
		}
	}
	
	let checkPath = process.env['GOPATH'] + '/src/' + chainCodePath;
	
	fs.exists(checkPath, function(exists) {
		if(exists){
			bcClient.initChainCode(invoker, chainCodeId, chainCodePath, chainCodeVer, args, initType)
			.then(() => {
				log.info("체인코드 Instantiate 성공 ");
				res.status(200).send({ msg : '성공' });
			}).catch((err) => {
				log.error('initChainCode - ' + err.message);
				res.status(500).send({ error : err.message });
			});
		}else{
			log.error(checkPath);
			res.status(500).send({ error : checkPath + ' - 존재하지 않는 경로입니다.' });
		}
	});
};