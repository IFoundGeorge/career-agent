import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

<<<<<<< HEAD
export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => mongoose);
=======
async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
>>>>>>> 3f25f8f5498176845d0b21a0a20f5376a4f6c101
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
<<<<<<< HEAD
=======

export default connectDB;
>>>>>>> 3f25f8f5498176845d0b21a0a20f5376a4f6c101
