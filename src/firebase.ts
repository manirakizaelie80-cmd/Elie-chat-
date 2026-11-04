import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app, 
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    }, 
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  // If already initialized (e.g. across reloads), gracefully fallback to existing instance
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface QuotaStatus {
  isQuotaExhausted: boolean;
  message: string;
  timestamp?: number;
}

type QuotaListener = (status: QuotaStatus) => void;
const quotaListeners = new Set<QuotaListener>();

export let currentQuotaStatus: QuotaStatus = {
  isQuotaExhausted: false,
  message: '',
};

export function subscribeQuotaStatus(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  listener(currentQuotaStatus);
  return () => quotaListeners.delete(listener);
}

export function reportQuotaExhausted(customMessage?: string) {
  currentQuotaStatus = {
    isQuotaExhausted: true,
    message: customMessage || 'Free daily quota limit reached. Elie Chat is operating in lightweight offline-cache mode.',
    timestamp: Date.now(),
  };
  quotaListeners.forEach((listener) => {
    try {
      listener(currentQuotaStatus);
    } catch {
      // ignore listener error
    }
  });
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const str = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    str.includes('resource-exhausted') ||
    str.includes('resource_exhausted') ||
    str.includes('quota exceeded') ||
    str.includes('quota_exceeded') ||
    str.includes('exceeded quota') ||
    str.includes('rate limit')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isQuotaError(error)) {
    console.warn(`Firestore Quota Saver: Gracefully intercepted quota limit on ${operationType} ${path}`);
    reportQuotaExhausted();
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Non-fatal error logging prevents unhandled exceptions from breaking UI
  if (import.meta.env.DEV) {
    console.debug('Dev Firestore Error Trace:', errInfo);
  }
}

// Test connection on boot as mandated (with quota and offline safety)
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (isQuotaError(error)) {
      reportQuotaExhausted();
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.info('Client offline; persistent cache will serve local documents.');
    }
  }
}
testConnection();
