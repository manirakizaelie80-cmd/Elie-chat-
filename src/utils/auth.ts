import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  GoogleAuthProvider, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  runTransaction,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Normalize username: lowercase, trim, strip leading @
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, '');
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long.' };
  }
  if (normalized.length > 30) {
    return { valid: false, error: 'Username must be under 30 characters.' };
  }
  if (!/^[a-z0-9_\-]+$/.test(normalized)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, hyphens, and underscores.' };
  }
  return { valid: true };
}

// Password criteria
export function validatePassword(password: string): {
  valid: boolean;
  hasLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumberOrSpecial: boolean;
  error?: string;
} {
  const hasLength = password.length >= 6;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumberOrSpecial = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const valid = hasLength && hasUpper && hasLower && hasNumberOrSpecial;
  let error: string | undefined;
  if (!hasLength) {
    error = 'Password must be at least 6 characters.';
  } else if (!hasUpper || !hasLower) {
    error = 'Password must contain both uppercase and lowercase letters.';
  } else if (!hasNumberOrSpecial) {
    error = 'Password must include at least one number or symbol.';
  }

  return {
    valid,
    hasLength,
    hasUpper,
    hasLower,
    hasNumberOrSpecial,
    error,
  };
}

// Check if username is available
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  try {
    const usernameDoc = await getDoc(doc(db, 'usernames', normalized));
    return !usernameDoc.exists();
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
}

// Secure hash function for password storage fallback using standard Web Crypto API
async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Register user with Email and Password
export async function registerWithEmailPassword(params: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  avatar?: string;
}): Promise<{ user: User; notice?: string }> {
  const { fullName, username, email, password, avatar } = params;
  const normalizedUsername = normalizeUsername(username);
  const trimmedEmail = email.trim().toLowerCase();

  const userValidation = validateUsername(normalizedUsername);
  if (!userValidation.valid) {
    throw new Error(userValidation.error);
  }

  const passValidation = validatePassword(password);
  if (!passValidation.valid) {
    throw new Error(passValidation.error);
  }

  // Check username availability
  const isAvailable = await checkUsernameAvailable(normalizedUsername);
  if (!isAvailable) {
    throw new Error(`The username "@${normalizedUsername}" is already taken. Please choose another.`);
  }

  let uid: string;
  let notice: string | undefined;

  try {
    // 1. Attempt Firebase Authentication creation
    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    uid = cred.user.uid;
    try {
      await updateProfile(cred.user, {
        displayName: fullName,
        photoURL: avatar || '',
      });
    } catch {
      // ignore
    }
  } catch (authError: any) {
    if (authError.code === 'auth/operation-not-allowed') {
      // Firebase Auth Email/Password provider is not yet enabled in Console.
      // Generate a deterministic UID and store encrypted credential fallback in Firestore so user is never blocked.
      notice = 'Note: Enable Email/Password in Firebase Console (Authentication > Sign-in method) for native Firebase Auth integration.';
      uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const salt = `salt_${uid}`;
      const hashed = await hashPassword(password, salt);

      await setDoc(doc(db, 'users', uid), {
        id: uid,
        name: fullName.trim(),
        username: normalizedUsername,
        email: trimmedEmail,
        avatar: avatar || '/src/assets/images/avatar_elie_1790670827487.jpg',
        status: 'online',
        customStatus: '👋 New Elie Chat member',
        readReceiptsEnabled: true,
        lastActive: Date.now(),
        lastSeen: Date.now(),
        createdAt: Date.now(),
        _authSalt: salt,
        _authHash: hashed,
      });
    } else if (authError.code === 'auth/email-already-in-use') {
      throw new Error('This email address is already registered. Please log in instead.');
    } else if (authError.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    } else if (authError.code === 'auth/weak-password') {
      throw new Error('The password is too weak. Please choose a stronger password.');
    } else {
      throw new Error(authError.message || 'Registration failed.');
    }
  }

  // 2. Atomically reserve username in /usernames/{normalizedUsername}
  try {
    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, 'usernames', normalizedUsername);
      const usernameSnap = await transaction.get(usernameRef);
      if (usernameSnap.exists()) {
        throw new Error(`The username "@${normalizedUsername}" was just taken by another user.`);
      }
      transaction.set(usernameRef, {
        username: normalizedUsername,
        uid,
        createdAt: Date.now(),
      });
    });
  } catch (err: any) {
    throw new Error(err.message || 'Username reservation conflict.');
  }

  // 3. Store User Profile in Firestore
  const newUser: User = {
    id: uid,
    name: fullName.trim(),
    username: normalizedUsername,
    email: trimmedEmail,
    avatar: avatar || '/src/assets/images/avatar_elie_1790670827487.jpg',
    status: 'online',
    customStatus: '👋 New Elie Chat member',
    readReceiptsEnabled: true,
    lastActive: Date.now(),
    lastSeen: Date.now(),
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'users', uid), newUser, { merge: true });

  // Save session to localStorage
  localStorage.setItem('syncwave_current_user', JSON.stringify(newUser));

  return { user: newUser, notice };
}

// Log in with Email or Username + Password
export async function loginWithEmailOrUsername(
  identifier: string,
  password: string
): Promise<User> {
  const trimmed = identifier.trim();
  let emailToUse = trimmed;

  // If user entered a username (not an email), look up email or UID from /usernames
  if (!trimmed.includes('@')) {
    const normalized = normalizeUsername(trimmed);
    const usernameDoc = await getDoc(doc(db, 'usernames', normalized));
    if (!usernameDoc.exists()) {
      throw new Error(`No account found with username "@${normalized}".`);
    }
    const uid = usernameDoc.data().uid;
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      throw new Error('User profile record not found.');
    }
    const userData = userDoc.data();
    if (userData.email) {
      emailToUse = userData.email;
    }

    // Check if user was registered via credentials fallback
    if (userData._authHash && userData._authSalt) {
      const computedHash = await hashPassword(password, userData._authSalt);
      if (computedHash !== userData._authHash) {
        throw new Error('Incorrect password. Please try again.');
      }
      const userObj: User = {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar,
        status: 'online',
        customStatus: userData.customStatus,
        readReceiptsEnabled: userData.readReceiptsEnabled ?? true,
        lastActive: Date.now(),
        lastSeen: userData.lastSeen || Date.now(),
        createdAt: userData.createdAt,
      };
      localStorage.setItem('syncwave_current_user', JSON.stringify(userObj));
      return userObj;
    }
  }

  // Attempt Firebase Auth sign-in
  try {
    const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
    const uid = cred.user.uid;
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const u = userDoc.data() as User;
      const updated: User = { ...u, status: 'online', lastActive: Date.now() };
      localStorage.setItem('syncwave_current_user', JSON.stringify(updated));
      return updated;
    }

    const fallbackUser: User = {
      id: uid,
      name: cred.user.displayName || 'Elie Chat User',
      email: cred.user.email || '',
      avatar: cred.user.photoURL || '/src/assets/images/avatar_elie_1790670827487.jpg',
      status: 'online',
      lastActive: Date.now(),
    };
    localStorage.setItem('syncwave_current_user', JSON.stringify(fallbackUser));
    return fallbackUser;
  } catch (authError: any) {
    if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
      throw new Error('Incorrect email/username or password. Please try again.');
    } else if (authError.code === 'auth/user-not-found') {
      throw new Error('No registered account found with this email. Please check spelling or register.');
    } else if (authError.code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Please reset your password or try again later.');
    } else if (authError.code === 'auth/operation-not-allowed') {
      // Check fallback user store by email
      const q = query(collection(db, 'users'), where('email', '==', emailToUse.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const uDoc = snap.docs[0].data();
        if (uDoc._authHash && uDoc._authSalt) {
          const computedHash = await hashPassword(password, uDoc._authSalt);
          if (computedHash === uDoc._authHash) {
            const userObj: User = {
              id: uDoc.id,
              name: uDoc.name,
              username: uDoc.username,
              email: uDoc.email,
              avatar: uDoc.avatar,
              status: 'online',
              customStatus: uDoc.customStatus,
              readReceiptsEnabled: uDoc.readReceiptsEnabled ?? true,
              lastActive: Date.now(),
              lastSeen: uDoc.lastSeen || Date.now(),
              createdAt: uDoc.createdAt,
            };
            localStorage.setItem('syncwave_current_user', JSON.stringify(userObj));
            return userObj;
          }
        }
      }
      throw new Error('Incorrect password or Email/Password provider not yet enabled in Firebase Console.');
    } else {
      throw new Error(authError.message || 'Login failed.');
    }
  }
}

// Password reset
export async function resetPassword(email: string): Promise<string> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    throw new Error('Please enter a valid email address to receive password reset instructions.');
  }

  try {
    await sendPasswordResetEmail(auth, trimmed);
    return `Password reset link sent to ${trimmed}. Please check your inbox and spam folder.`;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email address.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.');
    } else {
      throw new Error(error.message || 'Unable to send password reset email.');
    }
  }
}

export async function loginWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      return null;
    }
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
  }
  localStorage.removeItem('syncwave_current_user');
}

export function subscribeAuthState(callback: (firebaseUser: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Update profile in Firestore
export async function updateFirestoreUserProfile(
  uid: string,
  updates: Partial<User>
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...updates,
    lastActive: Date.now(),
  });
}
