const fs = require('fs');

const PromisePool = require('es6-promise-pool');
const sleep = require('system-sleep');
const xlsx2json = require('xlsx-to-json');

const cleaner = require('./cleaner.js');
const IziMongo = require('./izimongo.js');
const permutator = require('./permutator.js');
const checker = require('./checker.js');

function setConfig() {
	const config = require('./config.json');

	for(let i = 2; i < process.argv.length; ++i) {
		if(process.argv[i] === '--xlsx-file')
			config['xlsxFile'] = process.argv[i + 1];
		else if(process.argv[i] === '--export-file')
			config['exportFile'] = process.argv[i + 1];
		else if(process.argv[i] === '--threads')
			config['nbThreads'] = process.argv[i + 1];
		else if(process.argv[i] === '--prod')
			config['prodMode'] = true;
		else if(process.argv[i] === '--reset')
			consig['resetMode'] = true;
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

(async function main() {
	const config = setConfig();
	const entriesCollection = new IziMongo(config['dbUrl'], config['entriesCollectionName']);
	await entriesCollection.connect();
	const domainsCollection = new IziMongo(config['dbUrl'], config['domainsCollectionName']);
	await domainsCollection.connect();

	if(config.prodMode)
		console.log('Production mode enabled.');
	else if(config.resetMode) {
		console.log('Reset mode enabled.');
		await entriesCollection.drop();
		process.exit(0);
	}
	else if(config.exportFile) {
		console.log('Export mode enabled.');
		fs.writeFileSync(config.exportFile, JSON.stringify(await entriesCollection.all(), null, 4));
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
			entriesCollection.insert(entry);
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
				if(!entry.emailPossibilities) {
					entry.emailPossibilities = permutator.generate(entry.names, entry.domain);
					await entriesCollection.update(entry);
					//console.log('Email possibilities : ' + entry.emailPossibilities + '.');
				}

				// email testing
				if(!entry.testedEmails)
					entry.testedEmails = {};
				for(let emailPossibility of entry.emailPossibilities) {
					if(!entry.testedEmails[emailPossibility]) {
						try {
						   entry.testedEmails[emailPossibility] = await checker.checkEmail(emailPossibility);
						}
						catch(e) {
							return reject(e.message);
						}

						await entriesCollection.update(entry);
						console.log(emailPossibility + ' : ' + entry.testedEmails[emailPossibility]);
						if(entry.testedEmails[emailPossibility] === 'VALID')
							break;
						sleep(5000);
					}
				}

				if(config['prodMode']) {
					entry.processed = true;
					await entriesCollection.update(entry);
				}
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