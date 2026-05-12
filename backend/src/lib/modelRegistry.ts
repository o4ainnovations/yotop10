import mongoose from 'mongoose';

export function registerModel<T extends mongoose.Document>(
  name: string,
  schema: mongoose.Schema<T>
): mongoose.Model<T> {
  return (mongoose.models[name] as mongoose.Model<T> | undefined)
    ?? mongoose.model<T>(name, schema);
}
