const mongo = require('mongodb');
const PromisePool = require('es6-promise-pool');
const xlsx2json = require('xlsx-to-json');

const cleaner = require('./cleaner.js');
const permutator = require('./permutator.js');
const checker = require('./checker.js');

function setConfig() {
	const config = require('./config.json');

	for(let i = 2; i < process.argv.length; ++i) {
		if(process.argv[i] === '--xlsx-file')
			config.xlsxFile = process.argv[i + 1];
		else if(process.argv[i] === '--export-file')
			config.exportFile = process.argv[i + 1];
	}

	return config;
}

async function selectCollection(dbUrl, collectionName) {
	const db = await mongo.connect(dbUrl);
	const collection = await db.collection(collectionName);
	console.log('Collection "' + collectionName + '" selected.');
	return {db, collection};
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

async function readEntriesFromDatabase(collection) {
	return await collection.find({processed: false}).toArray();
}

async function writeEntryIntoDatabase(collection, entry) {
	const doc = await collection.findOne({id: entry.id});
	if(doc) {
		console.log('Entry already exists into database.');
		return;
	}
	await collection.insertOne(entry);
	console.log('New entry has been inserted into database.');
}

async function updateEntryIntoDatabase(collection, entry) {
	await collection.updateOne({id: entry.id}, entry);
	console.log('The entry "' + entry.id + '" has been updated into database.');
}

(async function main() {
	const config = setConfig();
	const {db, collection} = await selectCollection(config.dbUrl, config.collectionName);

	//if(config.exportFile)
		//exportDatabase(config.exportFile):

	if(config.xlsxFile) {
		console.log('Input file in configuration, reading...');
		const entries = await readEntriesFromXLSXFile(config.xlsxFile);
		for(let entry of entries) {
			entry = {
				id: entry['ID'],
				names: entry['Name'],
				domain: entry['Website Domain'],
				processed: false
			};
			//console.log(entry);
			await writeEntryIntoDatabase(collection, entry);
		}
		console.log('Entries from file have been written into database.');
	}

	const entries = await readEntriesFromDatabase(collection);

	if(entries.length === 0) {
        console.log('No entry to process.');
        process.exit(0);
    }

	let i = 0;
	const promiseProducer = function() {
		if(i < entries.length)
			return new Promise(async (resolve) => {
				const entry = entries[i++];
				console.log('Processing entry "' + entry.id + '"...');

                // name cleaning
                entry.names = cleaner.cleanName(entry.names);
                console.log('Name "' + entry.names + '" cleaned.');

                // email generating
                entry.emailPossibilities = permutator.generate(entry.names.split(' '), entry.domain);
                //console.log('Email possibilities : ' + entry.emailPossibilities + '.');

                // email testing
				if(!entry.testedEmails)
					entry.testedEmails = {};
				for(let emailPossibility of entry.emailPossibilities) {
                    entry.testedEmails[emailPossibility] = await checker.checkEmail(emailPossibility);
                    console.log(emailPossibility + ' : ' + entry.testedEmails[emailPossibility]);
                    if(entry.testedEmails[emailPossibility] === 'VALID')
                    	break;
                }

                //entry.processed = true;
                await updateEntryIntoDatabase(collection, entry);
                resolve();
			});
		else
			return null;
	};

    const endPromise = new PromisePool(promiseProducer, config.nbThreads).start();

    endPromise.then(() => {
        console.log(entries.length + ' entries processed.');
        process.exit(0);
	}, (error) => {
    	console.error(error);
        process.exit(1);
    });
})();