/**
 * Biometric Authentication Service
 * Handles Face ID, Touch ID, and fingerprint authentication
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger.js';

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
    logger.error('auth', 'Failed to enable biometric:', error);
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
    logger.error('auth', 'Failed to disable biometric:', error);
  }
}

/**
 * Check if biometrics can be used for login
 * (device has hardware, user has enrolled, and biometric login is enabled)
 * @returns {Promise<boolean>}
 */
export async function canUseBiometric() {
  try {
    const [supported, enrolled, enabled] = await Promise.all([
      isBiometricSupported(),
      hasBiometricEnrolled(),
      isBiometricEnabled(),
    ]);
    return supported && enrolled && enabled;
  } catch {
    return false;
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
    logger.error('auth', 'Biometric authentication error:', error);
    return false;
  }
}
