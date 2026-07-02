const path = require('path');
const backendDir = path.resolve(__dirname, '../kishostore_backend');
process.chdir(backendDir);
module.paths.push(path.join(backendDir, 'node_modules'));

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient(process.env.MONGO_URL);
  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    console.log("Connected successfully!");
    const db = client.db();
    const productsCollection = db.collection('products');

    // Find black-tiger
    const products = await productsCollection.find({}).toArray();
    const blackTiger = products.find(p => p.title.toLowerCase().includes("tiger") || p.basePrice === 1250);

    if (blackTiger) {
      console.log("Found BLACK-TIGER:", blackTiger.title);
      // Base price is 1250, 100 EGP discount means sale price is 1150 EGP
      const res = await productsCollection.updateOne({ _id: blackTiger._id }, { $set: { discountPrice: 1150 } });
      console.log("Updated black-tiger discountPrice to 1150 (100 EGP discount off 1250 EGP). Result:", res);
    }
  } catch (err) {
    console.error("MongoDB Driver Error:", err);
  } finally {
    await client.close();
  }
}

run();
