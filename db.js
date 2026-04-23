import mongoose from "mongoose";

// Account Schema
const accountSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    username: { type: String, default: null },
    session: { type: String, required: true },
    banned: { type: Boolean, default: false },
    frozen: { type: Boolean, default: false },
    currentGroupIndex: { type: Number, default: 0 }, // tracks rotation position
    groups: [
      {
        id: String,
        name: String,
        link: { type: String, default: null },
      },
    ],
  },
  { timestamps: true }
);

export const Account = mongoose.model("Account", accountSchema);

// Admin Schema (seeded)
const adminSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null, unique: true, sparse: true },
    username: { type: String, default: null, unique: true, sparse: true },
  },
  { timestamps: true }
);

export const Admin = mongoose.model("Admin", adminSchema);

// System / Bot Config Schema
const systemSchema = new mongoose.Schema(
  {
    forwardingActive: { type: Boolean, default: false },
    intervalMs: { type: Number, default: 5 * 60 * 1000 }, // default 5 min
    language: { type: String, enum: ["en", "hi"], default: "en" },
    message: {
      type: { type: String, enum: ["text", "photo", "video", "animation", "document", "audio"], default: "text" },
      text: { type: String, default: null },
      fileId: { type: String, default: null },
      caption: { type: String, default: null },
    },
  },
  { timestamps: true }
);

export const System = mongoose.model("System", systemSchema);

// Batch login queue (for bulk uploads)
const batchQueueSchema = new mongoose.Schema(
  {
    rows: { type: Array, default: [] }, // [{phone, password?}]
    currentIndex: { type: Number, default: 0 },
    adminUserId: { type: String, required: true },
  },
  { timestamps: true }
);

export const BatchQueue = mongoose.model("BatchQueue", batchQueueSchema);

export async function connectDB() {
  try {
    mongoose.set("runValidators", true);
    await mongoose.connect(process.env.MONGODB_URI, { dbName: "thwaha-forwarder" });
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}