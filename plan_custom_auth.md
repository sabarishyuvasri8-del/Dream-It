# Custom Clerk Auth Implementation Plan

We will replace the pre-built `<SignIn />` and `<SignUp />` components with a custom React component that strictly asks for a **Username** and **Password**, along with a **Continue with Google** button.

## Open Questions
- **Clerk Configuration**: If your Clerk Dashboard still requires an Email Address and does not have Username enabled, this custom code will throw an error when you try to submit the form. (I cannot change your Clerk Dashboard settings for you because I don't have your Clerk Secret Key or login credentials). 
- **The Flow**: You mentioned "enter username and password, then verify with Google". Clerk does not support using Google as a second-step verification *after* a password. You must either log in via Username/Password OR log in via Google. I will build the form to offer both options clearly.

## Proposed Changes

### `src/app/routes.tsx`
- **[MODIFY]** `src/app/routes.tsx`
  - Remove `<SignIn />` and `<SignUp />` from `@clerk/clerk-react`.
  - Import `useSignIn` and `useSignUp`.
  - Create a `CustomAuthForm` component that renders an input for `username` and `password`.
  - Add logic to handle `signIn.create({ identifier: username, password })` and `signUp.create({ username, password })`.
  - Add a button that triggers `signIn.authenticateWithRedirect({ strategy: "oauth_google" })`.

## Verification Plan
1. I will replace the component and you will see the UI change immediately.
2. You can attempt to sign up with a new username.
3. If it throws an error saying "Email is required", you will know that the Clerk Dashboard changes you made did not save correctly.
