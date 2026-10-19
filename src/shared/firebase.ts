/**
 * The Firebase project the studio signs in to.
 *
 * Not a secret: a Web app's config identifies the project to Google and is
 * shipped to every browser that loads it. Access is decided by the project's
 * own rules and by which sign-in providers are switched on, not by hiding this.
 *
 * The renderer initialises the SDK with it. The sign-in page, which is
 * `vsclaude-cloud`'s now (`server/utils/signin.ts`), carries a copy of it and
 * of the SDK version `firebase` in `package.json` resolves to — change those
 * there together with this and with that dependency.
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBzXBIKcX4_ZUDGinPNMnvv3z1H9jLwvnA",
  authDomain: "simm-chat.firebaseapp.com",
  projectId: "simm-chat",
  storageBucket: "simm-chat.firebasestorage.app",
  messagingSenderId: "935344658250",
  appId: "1:935344658250:web:9a1324c3113f3a341953b3",
  measurementId: "G-1ZFC8DPRV0",
}

/** The reason a sign-in ends when the user cancels it, rather than failing.
 * Shared so the renderer can tell it apart from a real error and not show it. */
export const SIGN_IN_CANCELLED = "Sign-in was cancelled."
