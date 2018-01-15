const cheerio = require('cheerio');
const request = require('request');
const config = require('./config.json');
const NeverBounce = require('neverbounce')({
	apiKey: config['apiKey'],
	apiSecret: config['apiSecret']
});

const STATUS = [
	'VALID',
	'INVALID',
	'DISPOSABLE',
	'CATCHALL',
	'UNKNOWN'
];

const checkEmailWithNeverBounce = function(email) {
	return new Promise((resolve, reject) => {
		console.log('Checking email address : "' + email + '"...');
		NeverBounce.single.verify(email).then(
			(result) => {
				//console.log(result);
				if(result.response.success)
					resolve(STATUS[result.response.result]);
				else
					reject('The email checking has failed.');
			},
			reject
		);
	});
};

const checkEmailWithEmailTester = function(email) {
	return new Promise((resolve, reject) => {
		request({
			url: 'http://mailtester.com/testmail.php',
			method: 'POST',
			form: {
				lang: 'en',
				email: email
			},
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:57.0) Gecko/20100101 Firefox/57.0'
			}
		}, (err, res, body) => {
			if(err)
				return reject(err);

			const $ = cheerio.load(body);
			const rows = $('table[cellspacing=0] > tbody > tr');
			if(!rows)
				return reject('The responded page is invalid.');

			const message = rows.last().text().trim();
			console.log(message);
			if(message.indexOf('E-mail address is valid') !== -1)
				resolve(STATUS[0]);
			else if(message.indexOf('E-mail address does not exist on this server') !== -1)
				resolve(STATUS[1]);
			else if(message.indexOf('Server doesn\'t allow e-mail address verification') !== -1)
				resolve(STATUS[4]);
			else if(message.indexOf('Unknown response from mail server') !== -1)
				resolve(STATUS[4]);
			else
				resolve('Unknown received message...');
		});
	});
};

module.exports = function(checker) {
	if(checker === 'neverbounce')
		return {checkEmail: checkEmailWithNeverBounce};
	else if(checker === 'emailtester')
		return {checkEmail: checkEmailWithEmailTester};
	else {
		console.error('Invalid provided email checker.');
		return null;
	}
};
//checkEmailWithNeverBounce(process.argv[2]).then(console.log).catch(console.error);
//checkEmailWithEmailTester(process.argv[2]).then(console.log).catch(console.error);