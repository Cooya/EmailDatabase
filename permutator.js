const permutations = [
	'{fn}',
	'{ln}',
	'{fn}{ln}',
	'{fi}.{ln}',
	'{fi}{ln}',
	'{fn}.{ln}',
	'{fn}{li}',
	'{fn}.{li}',
	'{fi}{li}',
	'{fi}.{li}',
	'{ln}{fn}',
	'{ln}.{fn}',
	'{ln}{fi}',
	'{ln}.{fi}',
	'{li}{fn}',
	'{li}.{fn}',
	'{li}{fi}',
	'{fi}{li}',
	'{fi}{mi}{ln}',
	'{fi}{mi}.{ln}',
	'{fn}{mi}{ln}',
	'{fn}.{mn}.{ln}',
	'{fn}{mn}{ln}',
	'{fn}.{mn}.{ln}',
	'{fn}-{ln}',
	'{fi}-{ln}',
	'{fn}-{li}',
	'{fi}-{li}',
	'{ln}-{fn}',
	'{ln}-{fi}',
	'{li}-{fn}',
	'{li}-{fi}',
	'{fi}{mi}-{ln}',
	'{fn}-{mi}-{ln}',
	'{fn}-{mn}-{ln}',
	'{fn}_{ln}',
	'{fi}_{ln}',
	'{fn}_{li}',
	'{fi}_{li}',
	'{ln}_{fn}',
	'{ln}_{fi}',
	'{li}_{fn}',
	'{li}_{fi}',
	'{fi}{mi}_{ln}',
	'{fn}_{mi}_{ln}',
	'{fn}_{mn}_{ln}',
	'{fn}.{ln}{ln2}',
	'{fn}.{ln}-{ln2}',
	'{fi}.{ln}-{ln2}',
	'{fi}.{ln}{ln2}',
	'{fi}{ln}{ln2}',
	'{fn}{ln2}',
	'{fn}.{ln2}',
	'{fi}{ln2}',
	'{fi}.{ln2}',
	'{fn}{li2}',
	'{fi}{li2}',
	'{fi}.{li2}'
];

function replacePatterns(permutation, names) {
	if(names.length > 0) {
		permutation = permutation.replace('{fn}', names[0]);
		permutation = permutation.replace('{fi}', names[0][0]);
	}
	if(names.length > 1) {
		permutation = permutation.replace('{ln}', names[names.length - 1]);
		permutation = permutation.replace('{li}', names[names.length - 1][0]);
	}
	if(names.length > 2) {
		permutation = permutation.replace('{mn}', names[1]);
		permutation = permutation.replace('{mi}', names[1][0]);
	}
	for(let i = 2; names.length > i + 1; ++i) {
		permutation = permutation.replace('{ln' + i + '}', names[i]);
		permutation = permutation.replace('{li' + i + '}', names[i][0]);
	}

	if(permutation.match(/\{[a-z]{2}[0-9]?\}/))
		return null;

	return permutation;
}

function readArgs() {
	const names = [];

	for(let i = 2; i < process.argv.length; ++i)
		names.push(process.argv[i]);

	return names;
}

const generate = function(names, domainName) {
	const array = [];
	let replacement;
	for(let permutation of permutations) {
		replacement = replacePatterns(permutation, names);
		if(replacement)
			array.push(replacement + '@' + domainName)
	}

	console.log(array.length + '/' + permutations.length + ' permutations.');
	return array;
}

console.log(generate(readArgs(), 'email.com'));
//module.exports = {generate: generate};