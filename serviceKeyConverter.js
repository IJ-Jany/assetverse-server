const fs = require('fs');

const jsonData = fs.readFileSync('./serviceAccountKey.json', 'utf-8');
const base64String = Buffer.from(jsonData, 'utf-8').toString('base64');

console.log(base64String);
