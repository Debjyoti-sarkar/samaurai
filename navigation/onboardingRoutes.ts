import type { AuthStep } from "@/contexts/AuthContext";

export type OnboardingStackRoute =
  | "Splash"
  | "LanguageSelection"
  | "PhoneVerification"
  | "BankLinking"
  | "SecuritySetup"
  | "Login"
  | "Tutorial"
  | "Dashboard";

/**
 * First screen after splash (or on cold start when splash already seen).
 */
export function getOnboardingInitialRoute(
  hasCompletedOnboarding: boolean,
  authStep: AuthStep
): OnboardingStackRoute {
  if (!hasCompletedOnboarding) {
    switch (authStep) {
      case "language_selection":
        return "LanguageSelection";
      case "phone_verification":
        return "PhoneVerification";
      case "bank_linking":
        return "BankLinking";
      case "security_setup":
        return "SecuritySetup";
      default:
        return "LanguageSelection";
    }
  }
  return "Login";
}
