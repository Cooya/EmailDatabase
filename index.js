const fs = require('fs');

const PromisePool = require('es6-promise-pool');
const sleep = require('system-sleep');
const xlsx2json = require('xlsx-to-json');

const cleaner = require('./cleaner.js');
const IziMongo = require('./izimongo.js');
const permutator = require('./permutator.js');
const checker = require('./checker.js')('neverbounce');

function setConfig() {
	const config = require('./config.json');

	for(let i = 2; i < process.argv.length; ++i) {
		if(process.argv[i] === '--xlsx-file')
			config['xlsxFile'] = process.argv[i + 1];
		else if(process.argv[i] === '--export-file')
			config['exportFile'] = process.argv[i + 1];
		else if(process.argv[i] === '--threads')
			config['nbThreads'] = process.argv[i + 1];
		else if(process.argv[i] === '--reset')
			config['resetMode'] = true;
		else if(process.argv[i] === '--valid-only')
			config['validOnly'] = true;
	}

	return config;
}

function readEntriesFromXLSXFile(xlsxFile) {
	return new Promise((resolve, reject) => {
		xlsx2json({
			input: xlsxFile,
			output: null,
		}, (err, result) => {
			if(err)
				return reject(err);
			resolve(result);
		});
	});
}

function markOtherEntriesAsSkipped(obj) {
	for(let key in obj)
		if(obj.hasOwnProperty(key) && !obj[key])
			obj[key] = 'SKIPPED';
}

function normalizeJSON(json, validOnly) {
	if(validOnly) {
        for(let entry of json) {
            for(let email in entry['emailPossibilities']) {
                if(entry['emailPossibilities'][email] === 'VALID') {
                    entry['validEmail'] = email.replace(/_dot_/g, '.');
                    break;
                }
            }

            if(!entry['validEmail'])
                entry['validEmail'] = 'none';
            delete entry['emailPossibilities'];
        }
	}
	else {
		let tmp;
        for(let entry of json) {
            tmp = Object.assign({}, entry['emailPossibilities']);
            entry['emailPossibilities'] = {};
            for(let email in tmp)
                entry['emailPossibilities'][email.replace(/_dot_/g, '.')] = tmp[email];
        }
    }

    return json;
}

(async function main() {
	const config = setConfig();
	const entriesCollection = new IziMongo(config['dbUrl'], config['entriesCollectionName']);
	await entriesCollection.connect();
	//const domainsCollection = new IziMongo(config['dbUrl'], config['domainsCollectionName']);
	//await domainsCollection.connect();

	if(config.resetMode) {
		console.log('Reset mode enabled.');
		await entriesCollection.empty();
		process.exit(0);
	}
	else if(config.exportFile) {
		console.log('Export mode enabled.');
		const json = normalizeJSON(await entriesCollection.all(), config.validOnly);
		fs.writeFileSync(config.exportFile, JSON.stringify(json, null, 4));
		console.log('The collection has been exported into the file "' + config.exportFile + '".');
		process.exit(0);
	}

	if(config.xlsxFile) {
		console.log('Input file in configuration, reading...');
		const entries = await readEntriesFromXLSXFile(config.xlsxFile);
		for(let entry of entries) {
			entry = {
				id: entry['ID'],
				name: entry['Name'],
				domain: entry['Website Domain'],
				processed: false
			};
			//console.log(entry);
			await entriesCollection.insert(entry);
		}
		console.log('Entries from file have been written into database.');
	}

	const unprocessedEntries = await entriesCollection.find({processed: false});

	if(unprocessedEntries.length === 0) {
		console.log('No entry to process.');
		process.exit(0);
	}

	let i = 0;
	const promiseProducer = function() {
		if(i < unprocessedEntries.length)
			return new Promise(async (resolve, reject) => {
				const entry = unprocessedEntries[i++];
				console.log('Processing entry "' + entry.id + '"...');

				// name cleaning
				if(!entry.names) {
					entry.names = cleaner.cleanName(entry.name);
					await entriesCollection.update(entry);
					//console.log('Name "' + entry.name + '" cleaned.');
				}

				// email generating
				if(!entry.emailPossibilities && entry.domain !== '#N/A') {
					entry.emailPossibilities = {};
					permutator.generate(entry.names, entry.domain).forEach((possibility) => {
						entry.emailPossibilities[possibility.replace(/\./g, '_dot_')] = null;
					});
					await entriesCollection.update(entry);
					//console.log('Email possibilities : ' + entry.emailPossibilities + '.');
				}

				// email testing
				if(entry.emailPossibilities) {
					let email;
					for(let possibility of Object.keys(entry.emailPossibilities)) {
						if(!entry.emailPossibilities[possibility]) {
							email = possibility.replace(/_dot_/g, '.');
							try {
							   	entry.emailPossibilities[possibility] = await checker.checkEmail(email);
								await entriesCollection.update(entry);
								console.log(email + ' : ' + entry.emailPossibilities[possibility]);
							}
							catch(e) {
								return reject(e.message);
							}

							// if any valid email has been found, we mark other possibilities and we stop to process this address
							if(entry.emailPossibilities[possibility] === 'VALID') {
								markOtherEntriesAsSkipped(entry.emailPossibilities);
								await entriesCollection.update(entry);
								break;
							}

							sleep(config.sleepTime); // for avoid stressing API
						}
					}
				}

				// save the email address as processed into database to avoid to process it again
				entry.processed = true;
				await entriesCollection.update(entry);
				resolve();
			});
		else
			return null;
	};

	const endPromise = new PromisePool(promiseProducer, config['nbThreads']).start();

	endPromise.then(() => {
		console.log(unprocessedEntries.length + ' entries processed.');
		process.exit(0);
	}, (error) => {
		console.error(error);
		process.exit(1);
	});
})();