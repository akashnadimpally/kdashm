import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { getAllowedUsers } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const allowedUsers = getAllowedUsers();
    const normalizedEmail = email.trim().toLowerCase();
    const userRecord = allowedUsers[normalizedEmail];

    if (!userRecord || userRecord.password !== password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(normalizedEmail, userRecord.role);
    const response = NextResponse.json({ 
      success: true, 
      email: normalizedEmail, 
      role: userRecord.role 
    });

    // Set cookie
    response.cookies.set({
      name: "kdashm_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
