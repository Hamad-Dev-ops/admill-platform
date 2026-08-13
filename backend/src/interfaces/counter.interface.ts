// Deliberately does not extend IBase: `_id` here is the sequence name (a string),
// not an ObjectId, and a counter is pure atomic-sequence infrastructure — not a
// business entity, so soft-delete/audit semantics don't apply.
export interface ICounter {
  _id: string;
  value: number;
}
