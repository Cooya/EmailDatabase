const mongo = require('mongodb');
const xlsx2json = require('xlsx-to-json');

const cleaner = require('./cleaner.js');
//const permutator = require('./epermetutator.js');
//const tester = require('etester.js');

const db;
const dbUrl = ''; // TO DO
const collectionName = '';

function readArgs() {
	const config = {};

	for(let i = 2; i < process.argv.length; ++i) {
		if(process.argv[i] == '--xslx-file')
			config.xslxFile = process.argv[i + 1];
	}

	return config;
}

async function selectCollection(dbUrl, collectionName) {
	if(!db)
		db = await mongo.connect(dbUrl);
	const collection = await db.collection(collectionName);
	return collection;
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

async function writeEntryIntoDatabase(collection, entry) { // TODO -> create a unique entry id
	const doc = await collection.findOne({name: entry.name});
	if(doc) {
		console.log('Entry already exists into database.');
		return;
	}
	await collection.insertOne(entry);
	console.log('New entry has been inserted into database.');
}

async function updateEntryIntoDatabase(collection, entry) {
	await collection.updateOne({id: entry.id}, entry);
	console.log('Entry has been updated into database.');
}

function main() {
	const config = readArgs();
	const collection = selectCollection(config.dbUrl, config.collectionName);

	//if(config.exportFile)
		//exportDatabase(config.exportFile):

	if(config.xslxFile) {
		const entries = await readEntriesFromXLSXFile(config.xslxFile);
		for(let entry of entries) {
			entry.processed = false;
			writeEntryIntoDatabase(collection, entry);
		}
		console.log('Entries from file have been written into database.');
	}

	const entries = await readEntriesFromDatabase(collection);

	entries.forEach((entry) => {
		// name cleaning
		entry.name = cleaner.cleanName(entry.name);
		updateEntryIntoDatabase(collection, entry);

		// email generating
		//const mails = combinator.getCombinaisons(entry.name);

		// email testing
		//const result = tester.checkEmail(entry.email);
	});

	console.log('Process done.');
}