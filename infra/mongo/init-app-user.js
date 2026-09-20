/* global db, process */

const databaseName = process.env.MONGO_INITDB_DATABASE || 'clinicos';
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;

if (!username || !password) {
  throw new Error('MONGO_APP_USERNAME and MONGO_APP_PASSWORD are required');
}

db.getSiblingDB(databaseName).createUser({
  user: username,
  pwd: password,
  roles: [{ role: 'readWrite', db: databaseName }],
});
