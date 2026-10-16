import type { Metadata } from "next";

import { SignInScreen } from "@/components/auth/SignInScreen";



export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <SignInScreen />;
}
