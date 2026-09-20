import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  scope: { type: String, required: true, unique: true },
  sequence: { type: Number, required: true, default: 0 },
});

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

export async function nextSequence(scope) {
  const counter = await Counter.findOneAndUpdate(
    { scope },
    { $inc: { sequence: 1 } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );
  return counter.sequence;
}
