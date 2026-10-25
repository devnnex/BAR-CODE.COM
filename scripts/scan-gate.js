// A code is counted once while it remains visible. Brief decoder misses do not
// rearm the scanner; the product must leave the camera view for a sustained time.
export function createScanGate({ absenceMs = 1200, minMisses = 3 } = {}) {
  let visibleCode = '';
  let missingSince = null;
  let misses = 0;

  return {
    observe(value, now = Date.now()) {
      const code = String(value || '').trim();
      if (code) {
        missingSince = null;
        misses = 0;
        if (code === visibleCode) return false;
        visibleCode = code;
        return true;
      }
      if (!visibleCode) return false;
      if (missingSince === null) missingSince = now;
      misses += 1;
      if (misses >= minMisses && now - missingSince >= absenceMs) {
        visibleCode = '';
        missingSince = null;
        misses = 0;
      }
      return false;
    }
  };
}
