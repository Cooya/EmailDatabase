const mongodb = require('mongodb');

module.exports = class IziMongo {
	constructor(dbUrl, collectionName) {
		this.dbUrl = dbUrl;
		this.collectionName = collectionName;
		this.container = {};
	}

	connect() {
		return mongodb.connect(this.dbUrl)
		.then((db) => {
			this.db = db;
			console.log('Connected to database.');
			return db.collection(this.collectionName);
		})
		.then((collection) => {
			this.collection = collection;
			console.log('Collection "' + this.collectionName + '" selected.');
			return this.collection.find().toArray();
		})
		.then((array) => {
			for(let doc of array)
				this.container[doc.id] = doc;
			return this.all();
		});
	}

	all() {
		return Object.values(this.container);
	}

	get(id) {
		return this.container[id];
	}

	find(query) {
		return this.collection.find(query).toArray();
	}

	insert(obj) {
		return this.collection.findOne({id: obj.id})
		.then((result) => {
			if(result) {
				console.log('Entry already exists into database.');
				return true;
			}
			else
				return this.collection.insertOne(obj)
				.then(() => {
					this.container[obj.id] = obj;
					console.log('New entry has been inserted into database.');
					return true;
				});
		});
	}

	set(obj) {
		return this.collection.updateOne({id: obj.id}, obj, {upsert: true})
		.then(() => {
			this.container[obj.id] = obj;
			//console.log('Entry has been updated into database.');
			return true;
		});
	}

	update(obj) {
		return this.collection.updateOne({id: obj.id}, obj)
		.then((result) => {
			if(result.modifiedCount === 1) {
				this.container[obj.id] = obj;
				//console.log('Entry has been set into database.');
				return true;
			}
			else
				return Promise.reject('This object id does not exist into this collection.');
		});
	}

	empty() {
		return this.collection.drop()
		.then(() => {
			this.container = {};
			console.log('Collection "' + this.collectionName + '" has been emptied.');
		});
	}
};