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
		else if(process.argv[i] === '--export-json')
			config['exportJSON'] = process.argv[i + 1];
		else if(process.argv[i] === '--export-csv')
			config['exportCSV'] = process.argv[i + 1];
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
	let tmp;
	let emailValue;
	let emailKeys;

	for(let entry of json) {
		tmp = Object.assign({}, entry['emailPossibilities']);
		entry['namesDetails'] = permutator.exportNames(entry['names']);
		entry['emailPossibilities'] = {};
		emailKeys = Object.keys(tmp);
		emailKeys.forEach((emailKey, index) => {
			if(!validOnly || (validOnly && tmp[emailKey] === 'VALID')) {
				delete entry['_id'];
				emailValue = emailKey.replace(/_dot_/g, '.');
				entry['emailPossibilities'][emailValue] = {
					status: tmp[emailKey],
					patterns: permutator.exportPermutation(index, entry.names) 
				};

				if(tmp[emailKey] === 'VALID')
					entry['emailFormat'] = entry['emailPossibilities'][emailValue]['patterns']['permutation'];
			}
		});
	}

	return json;
}

function normalizeCSV(json) {
	if(!json.length)
		return '';

	let csv = '';
	let values;
	let first = true;
    for(let entry of json) {
       	entry = Object.assign(entry, permutator.exportNames(entry['names'], true));
       	delete entry['names'];
        delete entry['emailPossibilities'];
        if(first) {
            csv += Object.keys(entry).join(';') + '\n';
            first = false;
        }

        values = Object.values(entry);
        for(let index in values)
            if(values[index])
            	values[index] = String(values[index]).replace(/,/g, '');
        csv += values.join(';') + '\n';
    }
    return csv;
}

async function checkEmailPossibility(entry, possibility, possibilityIndex, entriesCollection, domainsCollection) {
	const email = possibility.replace(/_dot_/g, '.');
	let status;
	try {
		status = await checker.checkEmail(email);
	}
	catch(e) {
		return {error: e.message};
	}

	entry.emailPossibilities[possibility] = entry['emailStatus'] = status;
	console.log(email + ' : ' + status);
		
	// if any valid email has been found, we mark other possibilities and we stop to process this address
	if(status === 'VALID') {
		entry['emailFormat'] = permutator.getPattern(possibilityIndex);
		entry['emailValid'] = email;
		markOtherEntriesAsSkipped(entry.emailPossibilities);
		const domainEntry = await domainsCollection.get(entry.domain);
		if(domainEntry) {
			if(domainEntry.indexes.indexOf(possibilityIndex) === -1) {
				domainEntry.indexes.push(possibilityIndex);
				await domainsCollection.update(domainEntry);
			}
		}
		else {
			await domainsCollection.insert({
				id: entry.domain,
				indexes: [possibilityIndex]
			});
		}
	}
	await entriesCollection.update(entry);
	return {valid: status === 'VALID'};
}

async function main() {
	const config = setConfig();
	const entriesCollection = new IziMongo(config['dbUrl'], config['entriesCollectionName']);
	await entriesCollection.connect();
	const domainsCollection = new IziMongo(config['dbUrl'], config['domainsCollectionName']);
	await domainsCollection.connect();

	if(config.resetMode) {
		console.log('Reset mode enabled.');
		await entriesCollection.empty();
		process.exit(0);
	}
	else if(config.exportJSON) {
		console.log('JSON export mode enabled.');
		const json = normalizeJSON(await entriesCollection.all(), config.validOnly);
		fs.writeFileSync(config.exportJSON, JSON.stringify(json, null, 4));
		console.log('The collection has been exported into the file "' + config.exportJSON + '".');
		process.exit(0);
	}
	else if(config.exportCSV) {
        console.log('CSV export mode enabled.');
        const csv = normalizeCSV(await entriesCollection.all(), config.validOnly);
        fs.writeFileSync(config.exportCSV, csv);
        console.log('The collection has been exported into the file "' + config.exportCSV + '".');
        process.exit(0);
	}

	if(config.xlsxFile) {
		console.log('Input file provided, reading...');
		const entries = await readEntriesFromXLSXFile(config.xlsxFile);
		for(let entry of entries) {
			entry = {
                name: entry['Name'] || entry['name'],
				job: entry['job'],
                location: entry['location'],
                company: entry['company'],
                companyUrl: entry['companyUrl'],
				domain: entry['Website Domain'] || entry['domain'] || entry['Domain'],
                id: entry['ID'] || entry['id'] || entry['Id'],
				url: entry['url'],
				processed: false,
				firstName: null,
				lastName1: null,
				lastName2: null,
				lastName3: null,
				lastName4: null,
				lastName5: null,
				emailStatus: null,
				emailFormat: null,
				emailValid: null
			};
			//console.log(entry);
            if(!entry['id'] || !entry['name'] || !entry['domain'])
            	console.error('Invalid entry found into the provided file, skipped.');
            else
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
				if(!entry['id'] || !entry['name'] || !entry['domain']) {
					console.log('Invalid entry found in database, removing...');
                    await entriesCollection.delete(entry['id']);
                    return resolve();
				}

				console.log('Processing entry "' + entry.id + '"...');

				// name cleaning
				if(!entry.names) {
					entry.names = cleaner.cleanName(entry.name);
					await entriesCollection.update(entry);
					//console.log('Name "' + entry.name + '" cleaned.');
				}

				// email generating
                if(entry.domain === '#N/A') {
					entry['emailStatus'] = 'BAD DOMAIN NAME';
                    await entriesCollection.update(entry);
				}
				else if(!entry.emailPossibilities) {
					entry.emailPossibilities = {};
					permutator.generate(entry.names, entry.domain).forEach((possibility) => {
						entry.emailPossibilities[possibility.replace(/\./g, '_dot_')] = null;
					});
					await entriesCollection.update(entry);
					//console.log('Email possibilities : ' + entry.emailPossibilities + '.');
				}

				// email testing
				if(entry.emailPossibilities) {
					const possibilities = Object.keys(entry.emailPossibilities);
					let result;
					let alreadyFound = false;

					// it already exists winning permutations for this domain name
					const winningPermutations = await domainsCollection.get(entry.domain);
					//console.log(winningPermutations);
					if(winningPermutations) {
						console.log('Winning permutation(s) have been found for this domain name.');
						for(let index of winningPermutations.indexes) {
							if(index < possibilities.length && !entry.emailPossibilities[possibilities[index]]) {
								result = await checkEmailPossibility(entry, possibilities[index], index, entriesCollection, domainsCollection);
								if(result.error)
									return reject(result.error);
								else if(result.valid) {
									console.log('Valid mail address found thanks to a prior possibility.');
									alreadyFound = true;
									break;
								}
							}

							sleep(config.sleepTime); // for avoid stressing API
						}
					}

					if(!alreadyFound) {
						let index = 0;
						for(let possibility of possibilities) {
							if(!entry.emailPossibilities[possibility]) {
								result = await checkEmailPossibility(entry, possibility, index, entriesCollection, domainsCollection);
								if(result.error)
									return reject(result.error);
								else if(result.valid)
									break;

								sleep(config.sleepTime); // for avoid stressing API
							}
							index++;
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
}

(async function run() {
	try {
		await main()
	}
	catch(e) {
		console.error(e);
		process.exit(1);
	}
})();