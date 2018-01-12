const NeverBounce = require('neverbounce')({
    apiKey: 'FUINJ6gC',
    apiSecret: 'n4R1pg8oAwC3KNE'
});

const STATUS = [
    'VALID',
    'INVALID',
    'DISPOSABLE',
    'CATCHALL',
    'UNKNOWN'
];

const checkEmail = function(email) {
    return new Promise((resolve, reject) => {
        console.log('Checking email address : "' + email + '"...');
        NeverBounce.single.verify(email).then(
            (result) => {
                //console.log(result);
                if(result.response.success)
                    resolve(STATUS[result.response.result]);
                else
                    reject('The email checking has failed.');
            },
            reject
        );
    });
};

module.exports = {checkEmail: checkEmail};
//checkEmail(process.argv[2]).then(console.log).catch(console.error);