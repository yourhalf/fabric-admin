'use strict';

const config = require('../configuration/config.json');
const log = require('../utils/logger.js')

let User = require('fabric-client/lib/User.js');
let copService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
let hfc = require('fabric-client');
let utils = require('fabric-client/lib/utils.js');
let Peer = require('fabric-client/lib/Peer.js');
let Orderer = require('fabric-client/lib/Orderer.js');
let EventHub = require('fabric-client/lib/EventHub.js');
let util = require('util');
var path = require('path');
var fs = require('fs');

let client = new hfc();
let ca_client = new copService(config.caserver.ca_url);
let eventhub;

let adminUser;

function startUp() {
	log.info('startUp()');
	
	let chain = client.newChain(config.chainName);
	chain.addOrderer(new Orderer(config.orderer.orderer_url));

	for (let i = 0; i < config.peers.length; i++) {
		chain.addPeer(new Peer(config.peers[i].peer_url));
		// log.debug('added peer: ' + config.peers[i].peer_url);
	}

	eventhub = new EventHub();
	eventhub.setPeerAddr(config.events[0].event_url);
	eventhub.connect();

	log.info('eventhub connected');
	log.info(config.keyValStore);
	
	return hfc.newDefaultKeyValueStore({
		path: process.env['HOME'] + config.keyValStore
	}).then((store) => {
	    log.debug(store);
	    return client.setStateStore(store);
	}).then(() => {
	    return getUser(config.registrar.name)
	}).catch((err) => {
		log.debug(err + " : admin 사용자 정보를 찾을 수 없어 enroll을 수행합니다.");
	    return registrar();
	}).then((user) => {
	    adminUser = user;
	    log.debug(adminUser.getName());
	    
	}).catch((err) => {
	    throw new Error(err);
	})
}
exports.startUp = startUp;

function init() {
	log.info('init()');
	let chain = client.getChain(config.chainName);

	return getUser('admin')
	.then(()=>{
		return createChannel()
	}).catch((err) => {
		log.warn(err);
	}).then(() => {
		return joinChannel();
	}).then((result) => {
		log.info('Join Channel 완료: ' + JSON.stringify(result));
	}).catch((err) => {
		log.error(err);
		throw new Error("초기화 실패!!");
	});
}
exports.init = init;


function createChannel(){
	log.info('createChannel()');

	let orderer = new Orderer(config.orderer.orderer_url);
	let data = fs.readFileSync('mychannel.tx');
	let request = {
		envelope : data,
		name : 'mychannel',
		orderer : orderer
	};
	// send to orderer

	return client.createChannel(request);
}

function joinChannel(){
	log.info('joinChannel()');
	
	let chain = client.getChain(config.chainName);
	let targets = [];
	for (let i = 0; i < config.peers.length; i++) {
		targets.push(new Peer(config.peers[i].peer_url));
	}

	let nonce = utils.getNonce();
	let tx_id = hfc.buildTransactionID(nonce, adminUser);

	let request = {
		targets : targets,
		txId : tx_id,
		nonce : nonce
	};

	return chain.joinChannel(request);
}

function registrar(){
	var username = config.registrar.name;
	var password = config.registrar.secret;
	var member;
	
	var ca_client = new copService(config.caserver.ca_url);
	return ca_client.enroll({
		enrollmentID: username,
		enrollmentSecret: password
	}).then((enrollment) => {
		member = new User(username, client);
		return member.setEnrollment(enrollment.key, enrollment.certificate, config.mspId);
	}).then(() => {
		return client.setUserContext(member);
	}).catch((err) => {
		log.error("Failed to enroll - '" + username + "' : " + err.stack ? err.stack : err);
		throw new Error("Failed to obtain an enrolled user : '" + username + "'");
	});
};


function register(userName){
	return ca_client.register({
		enrollmentID: userName,
		affiliation : 'org1.department1'
	}, adminUser);
};
exports.register = register;


function enroll(userName, secret){
	log.debug("enroll()");
	let member;
	return ca_client.enroll({
		enrollmentID: userName, 
		enrollmentSecret: secret
	})
	.then((enrollment) => {	
		member = new User(userName);
		return member.setEnrollment(enrollment.key, enrollment.certificate, config.mspId);
	})
	.then(() => {
		log.info('Successfully enrolled user \'' + userName + '\'');
		return client.setUserContext(member);
	})
	.then((user) => {
		log.info('Current Context :  \'' + user.getName() + '\'');
		return user;
	})
	.catch((err) => {
		log.error('Failed to enroll and persist user. Error: ' + err.stack ? err.stack : err);
		throw new Error('Enroll 실패');
	});
}
exports.enroll = enroll;

function getUser(userName){
	return client.loadUserFromStateStore(userName)
	.then((user) => {
		log.info('Successfully Loaded user \'' + user.getName() + '\'');
		return client.setUserContext(user);
	})
	.then((user) => {
		log.info('Current Context :  \'' + user.getName() + '\'');
		return user;
	})
	.catch((err) => {
		log.error('Failed to get User. Error: ' + err.stack ? err.stack : err);
		throw new Error('Get User 실패');
	});
}
exports.getUser = getUser;

function instChainCode(invoker, id, path, ver) {
	log.debug("instChainCode()");
	let chain = client.getChain(config.chainName);

	let targets = [];
	for (let i = 0; i < config.peers.length; i++) {
		targets.push(new Peer(config.peers[i].peer_url));
	}

	return getUser(invoker)
	.then((user) => {
		let nonce = utils.getNonce();
		let tx_id = hfc.buildTransactionID(nonce, user);

		// send proposal to endorser
		let request = {
			targets: targets,
			chaincodePath: path,
			chaincodeId: id,
			chaincodeVersion: ver,
			txId: tx_id,
			nonce: nonce
		};

		return client.installChaincode(request);
	}, (err) => {
		log.error('Failed to getUser. Error: ' + err.stack ? err.stack : err );
		throw new Error('Failed to getUser : ' + err);
	}).then((results) => {
		let proposalResponses = results[0];
		let proposal = results[1];
		let header   = results[2];

		let all_good = true;
		
		for(let i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
				one_good = true;
				log.info('install proposal was good');
			} else {
				log.error('install proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			log.info(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s', proposalResponses[0].response.status));
		} else {
			log.error('Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	},
	(err) => {
		log.error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
	});
}
module.exports.instChainCode = instChainCode;

function initChainCode(invoker, id, path, ver, args, isUpgrade) {
	log.debug("initChainCode()");
	
	let chain = client.getChain(config.chainName);
	let targets = [];
	let eventhubs = [];
	let tx_id; 
	let nonce;
	let type = 'Instantiate';
	if(isUpgrade){type = 'Upgrade'}
	
	for (let i = 0; i < config.peers.length; i++) {
		targets.push(new Peer(config.peers[i].peer_url));
	}
	eventhubs.push(eventhub);

	let userToBuildTxId;
	return getUser(invoker)
	.then((user) => {
		userToBuildTxId = user;
		return chain.initialize();
	}, (err) => {
		log.error('Failed to getUser. Error: ' + err.stack ? err.stack : err );
		throw new Error('Failed to getUser : ' + err);
	}).then((success) => {
		nonce = utils.getNonce();
		tx_id = hfc.buildTransactionID(nonce, userToBuildTxId);
		// send proposal to endorser
		let request = {
			chaincodePath: path,
			chaincodeId: id,
			chaincodeVersion: ver,
			fcn: 'init',
			args: args,
			txId: tx_id,
			chainId: config.chainName,
			nonce: nonce,
		        'endorsement-policy': {
				identities: [
					{ role: { name: 'member', mspId: 'Org1MSP' }}//,
					//{ role: { name: 'member', mspId: 'Org2MSP' }}
				],
				policy: {
					'1-of': [
						{'signed-by': 0}//,
						//{'signed-by': 1}
					]
				}
			}	
		};
		
		if(isUpgrade) return chain.sendUpgradeProposal(request);
		else return chain.sendInstantiateProposal(request);
		
	}, (err) => {
		log.error('Failed to initialize the chain');
		throw new Error('Failed to initialize the chain');
	}).then((results) => {
		let proposalResponses = results[0];
		let proposal = results[1];
		let header   = results[2];
		let all_good = true;
		for(let i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
				one_good = true;
				log.info(type +' proposal was good');
			} else {
				log.error(type +' proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			log.info(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
			let request = {
				proposalResponses: proposalResponses,
				proposal: proposal,
				header: header
			};

			let deployId = tx_id.toString();

			let eventPromises = [];
			eventhubs.forEach((eh) => {
				let txPromise = new Promise((resolve, reject) => {
					let handle = setTimeout(reject, 300000);

					eh.registerTxEvent(deployId.toString(), (tx, code) => {
						log.info('The chaincode ' + type + ' transaction has been committed on peer '+ eh.ep._endpoint.addr);
						clearTimeout(handle);
						eh.unregisterTxEvent(deployId);

						if (code !== 'VALID') {
							log.error('The chaincode ' + type + ' transaction was invalid, code = ' + code);
							reject();
						} else {
							log.info('The chaincode ' + type + ' transaction was valid.');
							resolve();
						}
					});
				});
				log.info('register eventhub %s with tx=%s',eh.ep._endpoint.addr,tx_id);
				eventPromises.push(txPromise);
			});

			let sendPromise = chain.sendTransaction(request);
			return Promise.all([sendPromise].concat(eventPromises))
			.then((results) => {
				log.debug('Event promise all complete and testing complete');
				return results[0]; // just first results are from orderer, the rest are from the peer events
			}).catch((err) => {
				log.error('Failed to send ' + type + ' transaction and get notifications within the timeout period.');
				throw new Error('Failed to send ' + type + ' transaction and get notifications within the timeout period.');
			});
		} else {
			log.error('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	}, (err) => {
		log.error('Failed to send ' + type + ' proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send ' + type + ' proposal due to error: ' + err.stack ? err.stack : err);
	}).then((response) => {
		//TODO should look into the event responses
		if (!(response instanceof Error) && response.status === 'SUCCESS') {
			log.info('Successfully sent ' + type + 'transaction to the orderer.');
			return true;
		} else {
			log.error('Failed to order the ' + type + 'transaction. Error code: ' + response.status);
			throw new Error('Failed to order the ' + type + 'transaction. Error code: ' + response.status);
		}
	}, (err) => {
		log.error('Failed to send ' + type + ' due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send instantiate due to error: ' + err.stack ? err.stack : err);
	});
};
module.exports.initChainCode = initChainCode;

function queryChaincode(invoker, id, fcn, args, ver){
	log.debug('queryChaincode('+ invoker + ', ' + id + ', '  + fcn + ', [' + args + '], ' + ver   +')');

	let chain = client.getChain(config.chainName);
	let targets = [];
	let eventhubs = [];
	let tx_id; 
	let nonce;
	
	for (let i = 0; i < config.peers.length; i++) {
		targets.push(new Peer(config.peers[i].peer_url));
	}

	return getUser(invoker)
   .then((user) => {
		nonce = utils.getNonce();
		tx_id = hfc.buildTransactionID(nonce, user);
		
		// send query
		let request = {
			chaincodeId : id,
			chaincodeVersion : ver,
			chainId: config.chainName,
			txId: tx_id,
			nonce: nonce,
			fcn: fcn,
			args: args
		};
		return chain.queryByChaincode(request);
	}, (err) => {
		log.error('Failed to getUser. Error: ' + err.stack ? err.stack : err );
		throw new Error('Failed to getUser : ' + err);
	}).then((response_payloads) => {
		if (response_payloads) {
			let result = '';
			for(let i = 0; i < response_payloads.length; i++) {
				result += (response_payloads[i].toString('utf8'));
				log.info(response_payloads[i].toString('utf8'));
			}
			return result;
		} else {
			log.error('response_payloads is null');
			throw new Error('Failed to get response on query');
		}
	},
	(err) => {
		log.error('Failed to send query due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed, got error on query');
	});
};
module.exports.queryChaincode = queryChaincode;


function invokeChaincode(invoker, id, fcn, args, ver){
	log.debug('invokeChaincode('+ invoker + ', ' + id + ', '  + fcn + ', [' + args + '], ' + ver   +')');

	let chain = client.getChain(config.chainName);
	let targets = [];
	let eventhubs = [];
	let tx_id; 
	let nonce;

	for (let i = 0; i < config.peers.length; i++) {
		targets.push(new Peer(config.peers[i].peer_url));
	}
	
	eventhubs.push(eventhub);

	let userToBuildTxId;
	return getUser(invoker)
	.then((user) => {
		userToBuildTxId = user;
		return chain.initialize();
	}, (err) => {
		log.error('Failed to getUser. Error: ' + err.stack ? err.stack : err );
		throw new Error('Failed to getUser : ' + err);	
	}).then((results) => {
		nonce = utils.getNonce();
		tx_id = hfc.buildTransactionID(nonce, userToBuildTxId);

		log.info('setConfigSetting("E2E_TX_ID") = %s', tx_id);
		log.info(util.format('Sending transaction "%s"', tx_id));

		// send proposal to endorser
		let request = {
			chaincodeId : id,
			chaincodeVersion : ver,
			fcn: fcn,
			args: args,
			chainId: config.chainName,
			txId: tx_id,
			nonce: nonce
		};
		return chain.sendTransactionProposal(request);
	}, (err) => {
		throw new Error('Failed to send Transaction ' + err);
	}).then((results) => {
		let proposalResponses = results[0];
		let proposal = results[1];
		let header   = results[2];
		let all_good = true;
		for(let i in proposalResponses) {
			let one_good = false;
			let proposal_response = proposalResponses[i];
			if( proposal_response.response && proposal_response.response.status === 200) {
				log.info('transaction proposal has response status of good');
				one_good = chain.verifyProposalResponse(proposal_response);
				if(one_good) {
					log.info(' transaction proposal signature and endorser are valid');
				}
			} else {
				log.error('transaction proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			all_good = chain.compareProposalResponseResults(proposalResponses);
			log.info('compareProposalResponseResults exection did not throw an error');
			if(all_good){
				log.info(' All proposals have a matching read/writes sets');
			}
			else {
				log.error(' All proposals do not have matching read/write sets');
			}
		}
		if (all_good) {
			log.info(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
			let request = {
				proposalResponses: proposalResponses,
				proposal: proposal,
				header: header
			};

			let deployId = tx_id.toString();

			let eventPromises = [];
			eventhubs.forEach((eh) => {
				let txPromise = new Promise((resolve, reject) => {
					let handle = setTimeout(reject, 30000);

					eh.registerTxEvent(deployId.toString(), (tx, code) => {
						clearTimeout(handle);
						eh.unregisterTxEvent(deployId);

						if (code !== 'VALID') {
							log.error('The balance transfer transaction was invalid, code = ' + code);
							reject();
						} else {
							log.info('The balance transfer transaction has been committed on peer '+ eh.ep._endpoint.addr);
							resolve();
						}
					});
				});
				eventPromises.push(txPromise);
			});

			let sendPromise = chain.sendTransaction(request);
			return Promise.all([sendPromise].concat(eventPromises))
			.then((results) => {
				log.debug(' event promise all complete and testing complete');
				return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
			}).catch((err) => {
				log.error('Failed to send transaction and get notifications within the timeout period.');
				throw new Error('Failed to send transaction and get notifications within the timeout period.');
			});
		} else {
			log.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	}, (err) => {
		log.error('Failed to send proposal due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send proposal due to error: ' + err.stack ? err.stack : err);
	}).then((response) => {
		if (response.status === 'SUCCESS') {
			log.info('Successfully sent transaction to the orderer.');
			log.info('******************************************************************');
			log.info('export TX_ID='+'\''+tx_id+'\'');
			log.info('******************************************************************');
			return 'TX_ID='+'\''+tx_id+'\'';
		} else {
			log.error('Failed to order the transaction. Error code: ' + response.status);
			throw new Error('Failed to order the transaction. Error code: ' + response.status);
		}
	}, (err) => {
		log.error('Failed to send transaction due to error: ' + err.stack ? err.stack : err);
		throw new Error('Failed to send transaction due to error: ' + err.stack ? err.stack : err);
	});
};
module.exports.invokeChaincode = invokeChaincode;
