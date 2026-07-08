import { NextResponse } from "next/server";
import { db } from "~/server/clients/db";
import { hashPassword } from "better-auth/crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, email, newPassword } = body;

    if (!username || !email) {
      return NextResponse.json(
        { error: "Username and email are required" },
        { status: 400 }
      );
    }

    // Step 1: Verify the user exists with matching username and email
    const user = await db.user.findFirst({
      where: {
        username,
        email,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Authentication failed: Invalid username or email" },
        { status: 401 }
      );
    }

    // Step 2: If a new password is provided, reset it
    if (newPassword) {
      // Find the credential account for this user
      const account = await db.account.findFirst({
        where: {
          userId: user.id,
          providerId: "credential",
        },
      });

      if (!account) {
        return NextResponse.json(
          { error: "No credential account found for this user." },
          { status: 400 }
        );
      }

      // Hash the new password using better-auth's crypto
      const hashedPassword = await hashPassword(newPassword);

      // Update the account record
      await db.account.update({
        where: {
          id: account.id,
        },
        data: {
          password: hashedPassword,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Password updated successfully",
      });
    }

    // Step 1 Success: Just verification
    return NextResponse.json({
      success: true,
      message: "Authentication successful",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
