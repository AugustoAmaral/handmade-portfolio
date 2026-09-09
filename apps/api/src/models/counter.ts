import mongoose, { Schema } from 'mongoose'

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
})

export const Counter = mongoose.model('Counter', counterSchema)

const ORDER_COUNTER_ID = 'order'

// Atomic $inc with upsert. Two concurrent first calls can race on the upsert and one of them
// gets E11000 on the _id index — retry once; the second attempt finds the document.
export async function nextOrderNumber(): Promise<number> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const doc = await Counter.findOneAndUpdate(
        { _id: ORDER_COUNTER_ID },
        { $inc: { seq: 1 } },
        { upsert: true, new: true },
      )
      return doc!.seq
    } catch (err) {
      if ((err as { code?: number }).code !== 11000 || attempt === 1) throw err
    }
  }
  throw new Error('unreachable')
}
