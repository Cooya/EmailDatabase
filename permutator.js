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
	'{fi}{li2}{ln}',
	'{fi}{li2}.{ln}',
	'{fn}{li2}{ln}',
	'{fn}.{ln2}.{ln}',
	'{fn}{ln2}{ln}',
	'{fn}.{ln2}.{ln}',
	'{fn}-{ln}',
	'{fi}-{ln}',
	'{fn}-{li}',
	'{fi}-{li}',
	'{ln}-{fn}',
	'{ln}-{fi}',
	'{li}-{fn}',
	'{li}-{fi}',
	'{fi}{li2}-{ln}',
	'{fn}-{li2}-{ln}',
	'{fn}-{ln2}-{ln}',
	'{fn}_{ln}',
	'{fi}_{ln}',
	'{fn}_{li}',
	'{fi}_{li}',
	'{ln}_{fn}',
	'{ln}_{fi}',
	'{li}_{fn}',
	'{li}_{fi}',
	'{fi}{li2}_{ln}',
	'{fn}_{li2}_{ln}',
	'{fn}_{ln2}_{ln}',
	'{fn}.{ln}{ln3}',
	'{fn}.{ln}-{ln3}',
	'{fi}.{ln}-{ln3}',
	'{fi}.{ln}{ln3}',
	'{fi}{ln}{ln3}',
	'{fn}{ln3}',
	'{fn}.{ln3}',
	'{fi}{ln3}',
	'{fi}.{ln3}',
	'{fn}{li3}',
	'{fi}{li3}',
	'{fi}.{li3}',
	'{fn}.{ln}{ln3}{ln4}',
	'{fn}.{ln}-{ln3}-{ln4}',
	'{fi}.{ln}-{ln3}-{ln4}',
	'{fi}.{ln}{ln3}{ln4}',
	'{fn}{ln4}',
	'{fn}.{ln4}',
	'{fi}{ln4}',
	'{fi}.{ln4}',
	'{fn}{ln4}',
	'{fi}{ln4}',
	'{fi}.{ln4}',
	'{fn}.{ln}{ln3}{ln4}{ln5}',
	'{fn}.{ln}-{ln3}-{ln4}-{ln5}',
	'{fi}.{ln}-{ln3}-{ln4}-{ln5}',
	'{fi}.{ln}{ln3}{ln4}{ln5}',
	'{fn}{ln5}',
	'{fn}.{ln5}',
	'{fi}{ln5}',
	'{fi}.{ln5}',
	'{fn}{ln5}',
	'{fi}{ln5}',
	'{fi}.{ln5}'
];

function exportPermutation(index, names) {
	const permutation = permutations[index];
	const output = {permutation: permutation};
	const patterns = permutation.match(/[a-z]{2}[0-9]?/g);
	for(let pattern of patterns) {
		if(pattern == 'fn')
			output[pattern] = names[0];
		else if(pattern == 'fi')
			output[pattern] = names[0][0];
		else if(pattern == 'ln')
			output[pattern] = names[names.length - 1];
		else if(pattern == 'li')
			output[pattern] = names[names.length - 1][0];
		else if(pattern.match(/ln[0-9]+/))
			output[pattern] = names[pattern.match(/[0-9]+/)[0] - 1]
		else if(pattern.match(/li[0-9]+/))
			output[pattern] = names[pattern.match(/[0-9]+/)[0] - 1][0]
		else
			console.error('Unknown pattern : ' + pattern);
	}
	return output;
}

function exportNames(names) {
	const result = {};
	let key;
	names.forEach((value, index) => {
		if(index == 0)
			key = 'fn';
		else if(index == names.length - 1)
			key = 'ln';
		else
			key = 'ln' + (index - 1);
		result[key] = value;
	});
	return result;
}

function replacePatterns(permutation, names) {
	if(names.length > 0) {
		permutation = permutation.replace('{fn}', names[0]);
		permutation = permutation.replace('{fi}', names[0][0]);
	}
	if(names.length > 1) {
		permutation = permutation.replace('{ln}', names[names.length - 1]);
		permutation = permutation.replace('{li}', names[names.length - 1][0]);
	}
	for(let i = 1; names.length > i + 1; ++i) {
		permutation = permutation.replace('{ln' + i + '}', names[i - 1]);
		permutation = permutation.replace('{li' + i + '}', names[i - 1][0]);
	}

	if(permutation.match(/{[a-z]{2}[0-9]?}/))
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
};

//console.log(generate(readArgs(), 'email.com'));
module.exports = {generate: generate, exportPermutation: exportPermutation, exportNames: exportNames};