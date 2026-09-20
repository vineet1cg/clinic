import 'dotenv/config';
import mongoose from 'mongoose';

const requiredNames = [
  'MONGO_ROOT_USERNAME',
  'MONGO_ROOT_PASSWORD',
  'MONGO_APP_USERNAME',
  'MONGO_APP_PASSWORD',
];

for (const name of requiredNames) {
  if (!process.env[name]) {
    throw new Error(`${name} is required in the root .env file`);
  }
}

const host = process.env.MONGO_HOST || '127.0.0.1';
const port = process.env.MONGO_PORT || '27017';
const databaseName = process.env.MONGO_DATABASE || 'clinicos';
const rootUsername = encodeURIComponent(process.env.MONGO_ROOT_USERNAME);
const rootPassword = encodeURIComponent(process.env.MONGO_ROOT_PASSWORD);
const rootUri = `mongodb://${rootUsername}:${rootPassword}@${host}:${port}/admin?authSource=admin`;

const connection = await mongoose.createConnection(rootUri).asPromise();

try {
  const database = connection.useDb(databaseName).db;
  const users = await database.command({ usersInfo: process.env.MONGO_APP_USERNAME });

  if (users.users.length > 0) {
    const roles = users.users[0].roles || [];
    const hasExpectedRole =
      roles.length === 1 && roles[0].role === 'readWrite' && roles[0].db === databaseName;
    if (!hasExpectedRole) {
      throw new Error(
        `MongoDB application user exists with unexpected roles; expected readWrite on ${databaseName}`,
      );
    }
    console.log(`MongoDB application user already exists in ${databaseName}.`);
  } else {
    await database.command({
      createUser: process.env.MONGO_APP_USERNAME,
      pwd: process.env.MONGO_APP_PASSWORD,
      roles: [{ role: 'readWrite', db: databaseName }],
    });
    console.log(`Created least-privilege MongoDB application user in ${databaseName}.`);
  }
} finally {
  await connection.close();
}
