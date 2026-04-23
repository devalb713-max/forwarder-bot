import dotenv from "dotenv";
import { connectDB, Admin, System } from "./db.js";

dotenv.config();

async function seed() {
  await connectDB();

  // Seed admins
  const admins = [
    { userId: "8486646787", username: null },
    { userId: "1632962204", username: null },
  ];

  for (const admin of admins) {
    await Admin.updateOne({ userId: admin.userId }, { $set: admin }, { upsert: true });
    console.log(`✅ Admin seeded: ${admin.userId}`);
  }

  // Ensure system doc exists
  const existing = await System.findOne({});
  if (!existing) {
    await new System({}).save();
    console.log("✅ System doc created");
  } else {
    console.log("ℹ️  System doc already exists");
  }

  console.log("✅ Seed complete");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
