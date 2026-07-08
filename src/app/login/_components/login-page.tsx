"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrustClawBrand } from "~/app/_components/trustclaw-brand";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { authClient } from "~/clients/auth/react";
import { showErrorToast, showSuccessToast } from "~/components/core/toast-notifications";

interface LoginPageProps {
  firstTime?: boolean;
}

export function LoginPage({ firstTime = false }: LoginPageProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regName, setRegName] = useState("");

  // Forgot Password state
  const [forgotPasswordState, setForgotPasswordState] = useState<"hidden" | "verify" | "reset">("hidden");
  const [fpUsername, setFpUsername] = useState("");
  const [fpEmail, setFpEmail] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpRePassword, setFpRePassword] = useState("");
  const [fpPasswordError, setFpPasswordError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const result = await authClient.signIn.username({
        username: loginUsername,
        password: loginPassword,
      });
      if (result.error) {
        showErrorToast(result.error.message ?? "Failed to sign in");
        return;
      }
      router.push("/dashboard");
    } finally {
      setPending(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const result = await authClient.signUp.email({
        email: regEmail,
        password: regPassword,
        username: regUsername,
        name: regName,
      });
      if (result.error) {
        showErrorToast(result.error.message ?? "Failed to create account");
        return;
      }
      router.push("/dashboard");
    } finally {
      setPending(false);
    }
  };

  const handleFpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fpUsername, email: fpEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        showErrorToast(data.error ?? "Authentication failed");
        return;
      }
      showSuccessToast(data.message ?? "Authentication successful");
      setForgotPasswordState("reset");
    } catch {
      showErrorToast("An error occurred during verification");
    } finally {
      setPending(false);
    }
  };

  const handleFpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fpNewPassword !== fpRePassword) {
      setFpPasswordError("Typed password doesn't match");
      return;
    }
    setFpPasswordError("");
    setPending(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: fpUsername,
          email: fpEmail,
          newPassword: fpNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showErrorToast(data.error ?? "Password reset failed");
        return;
      }
      showSuccessToast(data.message ?? "Password reset successfully");
      
      // Reset state and redirect back to login
      setFpUsername("");
      setFpEmail("");
      setFpNewPassword("");
      setFpRePassword("");
      setForgotPasswordState("hidden");
    } catch {
      showErrorToast("An error occurred during password reset");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center">
      <div className="mx-auto w-full max-w-sm px-4">
        <div className="mb-8 flex justify-center">
          <TrustClawBrand size="lg" logoLink="/" />
        </div>

        {forgotPasswordState === "verify" && (
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Forgot Password</h2>
            <form className="space-y-4" onSubmit={handleFpVerify}>
              <div className="space-y-2">
                <Label htmlFor="fp-username">Username</Label>
                <Input
                  id="fp-username"
                  type="text"
                  required
                  value={fpUsername}
                  onChange={(e) => setFpUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-email">Email</Label>
                <Input
                  id="fp-email"
                  type="email"
                  required
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Authenticating..." : "Authenticate"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:underline"
                  onClick={() => setForgotPasswordState("hidden")}
                >
                  Back to login
                </button>
              </div>
            </form>
          </div>
        )}

        {forgotPasswordState === "reset" && (
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Create New Password</h2>
            <form className="space-y-4" onSubmit={handleFpReset}>
              <div className="space-y-2">
                <Label htmlFor="fp-new-password">New password</Label>
                <Input
                  id="fp-new-password"
                  type="password"
                  required
                  minLength={8}
                  value={fpNewPassword}
                  onChange={(e) => {
                    setFpNewPassword(e.target.value);
                    setFpPasswordError("");
                  }}
                  className={fpPasswordError ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-re-password">Re-enter password</Label>
                <Input
                  id="fp-re-password"
                  type="password"
                  required
                  minLength={8}
                  value={fpRePassword}
                  onChange={(e) => {
                    setFpRePassword(e.target.value);
                    setFpPasswordError("");
                  }}
                  className={fpPasswordError ? "border-red-500" : ""}
                />
                {fpPasswordError && (
                  <p className="text-sm text-red-500">{fpPasswordError}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Updating..." : "Change password"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:underline"
                  onClick={() => setForgotPasswordState("hidden")}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {forgotPasswordState === "hidden" && (
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <Tabs defaultValue={firstTime ? "register" : "login"}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form className="space-y-4" onSubmit={handleLogin}>
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      type="text"
                      autoComplete="username"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? "Signing in..." : "Sign in"}
                  </Button>
                  <div className="text-center mt-2">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:underline"
                      onClick={() => setForgotPasswordState("verify")}
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-4">
                <form className="space-y-4" onSubmit={handleRegister}>
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Name</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      autoComplete="name"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-username">Username</Label>
                    <Input
                      id="reg-username"
                      type="text"
                      autoComplete="username"
                      required
                      minLength={3}
                      maxLength={30}
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? "Creating account..." : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
