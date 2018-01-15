# EmailDatabase

NodeJS script allowing to clean, generate and check email address possibilities in a client database.

## Installation
```
git clone https://github.com/Cooya/EmailDatabase.git
cd EmailDatabase
npm install
cp config.json.dist config.json
```
Complete the config.json file :
```js
{
    "dbUrl": "", // URL to the MongoDB databse (e.g. "mongodb://localhost:27017/db")
    "entriesCollectionName": "email.entries", // collection containing the email adresses data
    "domainsCollectionName": "email.domains", // not used so far
    "apiKey": "", // NeverBounce API key
    "apiSecret": "", // NeverBounce API secret
    "nbThreads": 3, // number of email adresses processed in the same time
    "sleepTime": 2000 // time in milliseconds between each request
}
```

## Usage

Run the script with XLSX input file (it will load the file data into the database and then process it) :
```bash
node index.js --xlsx-file misc/input.xlsx
```

Export the database to a JSON file :
```bash
node index.js --export-file output.json
```

Empty the email addresses collection :
```bash
node index.js --reset
```
