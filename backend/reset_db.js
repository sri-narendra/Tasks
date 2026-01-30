require('dotenv').config();
const mongoose = require('mongoose');
const { User, Board, List, Task, Attachment } = require('./models');

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL: reset_db.js CANNOT be run in production mode.');
    process.exit(1);
}

console.log('⚠️  WARNING: You are about to DESTROY ALL DATA in:', mongoUri);
console.log('This action cannot be undone.');

readline.question('Type "DELETE ALL" to confirm: ', async (answer) => {
    if (answer !== 'DELETE ALL') {
        console.log('Action cancelled.');
        process.exit(0);
    }

    try {
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        console.log('🗑️  Deleting Users...');
        await User.deleteMany({});
        
        console.log('🗑️  Deleting Boards...');
        await Board.deleteMany({});
        
        console.log('🗑️  Deleting Lists...');
        await List.deleteMany({});
        
        console.log('🗑️  Deleting Tasks...');
        await Task.deleteMany({});
        
        console.log('🗑️  Deleting Attachments...');
        await Attachment.deleteMany({});

        console.log('✨ All data successfully cleared.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
});
