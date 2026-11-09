import { isAddress, getAddress } from 'viem';

/**
 * Validates any user-supplied EVM wallet address and returns the canonical checksummed format.
 * 
 * Rules:
 * 1. Must be a string.
 * 2. Must start with 0x followed by exactly 40 hexadecimal characters.
 * 3. Supports valid lowercase, uppercase, or EIP-55 checksummed addresses.
 * 4. Rejects mixed-case addresses with invalid checksums.
 * 5. Rejects null, undefined, empty, or non-hex input.
 */
export function validateAndNormalizeAddress(rawAddress: unknown): string {
  if (typeof rawAddress !== 'string') {
    throw new Error('Wallet address must be a string.');
  }

  const trimmed = rawAddress.trim();
  if (!trimmed) {
    throw new Error('Wallet address cannot be empty.');
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error(`Invalid EVM address format: "${trimmed}". Expected "0x" followed by exactly 40 hexadecimal characters.`);
  }

  // If mixed case, verify that the checksum is valid
  const hasUpper = /[A-F]/.test(trimmed.slice(2));
  const hasLower = /[a-f]/.test(trimmed.slice(2));
  const isMixedCase = hasUpper && hasLower;

  if (isMixedCase && !isAddress(trimmed)) {
    throw new Error(`Invalid EVM address checksum: "${trimmed}". The mixed-case address fails EIP-55 checksum validation.`);
  }

  try {
    return getAddress(trimmed);
  } catch (err: any) {
    throw new Error(`Invalid EVM wallet address: "${trimmed}". ${err?.message || 'Address resolution failed.'}`);
  }
}
