/**
 * Biometric Authentication Service
 * Handles Face ID, Touch ID, and fingerprint authentication
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY_BIOMETRIC_ENABLED = 'budget_biometric_enabled';
const KEY_BIOMETRIC_EMAIL = 'budget_biometric_email';

/**
 * Check if device supports biometric authentication
 */
export async function isBiometricSupported() {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  return compatible;
}

/**
 * Check if user has enrolled biometrics on device
 */
export async function hasBiometricEnrolled() {
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Get available biometric types (fingerprint, faceId, iris)
 */
export async function getBiometricTypes() {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return types;
}

/**
 * Get friendly name for biometric type
 */
export function getBiometricName(types) {
  // Always return "Biometrics" for consistency
  return 'Biometrics';
}

/**
 * Check if biometric login is enabled
 */
export async function isBiometricEnabled() {
  try {
    const enabled = await SecureStore.getItemAsync(KEY_BIOMETRIC_ENABLED);
    return enabled === 'true';
  } catch {
    return false;
  }
}

/**
 * Get stored email for biometric login
 */
export async function getBiometricEmail() {
  try {
    return await SecureStore.getItemAsync(KEY_BIOMETRIC_EMAIL);
  } catch {
    return null;
  }
}

/**
 * Enable biometric login for user
 */
export async function enableBiometric(email) {
  try {
    await SecureStore.setItemAsync(KEY_BIOMETRIC_ENABLED, 'true');
    await SecureStore.setItemAsync(KEY_BIOMETRIC_EMAIL, email);
  } catch (error) {
    console.error('Failed to enable biometric:', error);
    throw error;
  }
}

/**
 * Disable biometric login
 */
export async function disableBiometric() {
  try {
    await SecureStore.deleteItemAsync(KEY_BIOMETRIC_ENABLED);
    await SecureStore.deleteItemAsync(KEY_BIOMETRIC_EMAIL);
  } catch (error) {
    console.error('Failed to disable biometric:', error);
  }
}

/**
 * Authenticate with biometrics
 * @returns {Promise<boolean>} true if authenticated successfully
 */
export async function authenticateWithBiometric() {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access your budget',
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });

    return result.success;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
}

/**
 * Check if biometric login is available and ready to use
 */
export async function canUseBiometric() {
  const [supported, enrolled, enabled] = await Promise.all([
    isBiometricSupported(),
    hasBiometricEnrolled(),
    isBiometricEnabled(),
  ]);

  return supported && enrolled && enabled;
}
