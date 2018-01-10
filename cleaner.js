String.prototype.removeAccents = function() {
	const accents = [
		/[\300-\306]/g, /[\340-\346]/g, // A, a
		/[\310-\313]/g, /[\350-\353]/g, // E, e
		/[\314-\317]/g, /[\354-\357]/g, // I, i
		/[\322-\330]/g, /[\362-\370]/g, // O, o
		/[\331-\334]/g, /[\371-\374]/g, // U, u
		/[\321]/g, /[\361]/g, // N, n
		/[\307]/g, /[\347]/g, // C, c
	];
	const noaccent = ['A','a','E','e','I','i','O','o','U','u','N','n','C','c'];
	 
	let str = this;
	for(var i = 0; i < accents.length; ++i)
		str = str.replace(accents[i], noaccent[i]);
	 
	return str;
}

const cleanName = function(name) {
	// ignore name if pattern is present
	if(name.indexOf('Member') != -1)
		return null;

	// replace accents by associated letters
	name = name.removeAccents();

	// remove points and letters before points
	name = name.replace(/\.|[a-zA-Z]\./g, '');

	// remove special characters
	name = name.replace(/[^a-zA-Z- ]/g, '');

	// replace multiple blanks by only one
	name = name.replace(/ {2,}/, ' ');

	// remove blanks at the beginning and the end of the string
	name = name.trim();

	// separate multiple names
	const names = name.split(' ');
	const result = {};
	result.initialName = name;
	if(names.length > 1) {
		result.first = names[0];
		result.second = names[1];
	}
	if(names.length > 2)
		result.third = names[2];
	if(names.length > 3)
		result.fourth = names[3];

	return result;
}


module.exports = {
	cleanName: cleanName
};
//console.log(cleanName(process.argv[2]));