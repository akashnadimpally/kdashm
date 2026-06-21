import fs from "fs";
import path from "path";

export interface UserRecord {
  password: string;
  role: string;
}

// Read and parse allowed_users.txt (Runs on Server Node.js context only)
export function getAllowedUsers(): Record<string, UserRecord> {
  const users: Record<string, UserRecord> = {};
  try {
    const filePath = path.join(process.cwd(), "allowed_users.txt");
    if (!fs.existsSync(filePath)) {
      console.warn("allowed_users.txt not found at", filePath);
      return users;
    }
    
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const parts = trimmed.split(":");
      if (parts.length < 2) continue;
      
      const email = parts[0].trim().toLowerCase();
      const password = parts[1].trim();
      // Default to 'reader' if no role is explicitly provided
      const role = (parts[2] || "reader").trim().toLowerCase();
      
      if (email && password) {
        users[email] = { password, role };
      }
    }
  } catch (e) {
    console.error("Error reading allowed_users.txt:", e);
  }
  return users;
}
